// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {DeskVault} from "./DeskVault.sol";
import {ISwapAdapter} from "./interfaces/ISwapAdapter.sol";

/**
 * @title Hoodesks
 * @notice 5,000 desks. Each is an NFT that owns a vault, and the vault fills
 *         with tokenised stock round after round.
 *
 * @dev The ledger is an accumulator-and-stamp, the pattern staking contracts
 *      use for rewards, with one accumulator per asset in the rotation:
 *
 *        accPerDesk[i]  units of asset i credited to every desk, ever,
 *                       scaled by ACC
 *        stamp[id][i]   how far desk `id` has already been paid
 *        owed           (accPerDesk[i] - stamp[id][i]) / ACC
 *
 *      A round therefore writes one number per round rather than paying five
 *      thousand vaults, and stays a single transaction at any supply.
 *
 *      Three properties fall out of keeping the stamp against the tokenId
 *      rather than against a wallet:
 *
 *        - Selling a desk hands over everything credited but not yet
 *          delivered. Nothing is settled on transfer; there is nothing to
 *          settle.
 *        - A desk minted today is stamped at the current accumulator, so it
 *          cannot claim rounds that fired before it existed.
 *        - Entitlement accrues whether or not the vault has been deployed.
 *          Deployment is lazy and happens on the first claim.
 *
 *      Integer division is handled rather than ignored: the remainder of each
 *      round is carried into the next (`carry`), and a claim advances the
 *      stamp only by what it actually paid, so sub-unit dust survives instead
 *      of being rounded away.
 *
 * @custom:trust The owner can repoint the swap adapter, which is trusted with
 *      the pot for the duration of one call. That is the sharpest edge in
 *      this contract and belongs behind a timelock in production.
 */
contract Hoodesks is ERC721, IERC2981, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Strings for uint256;

    /* ---------------------------------------------------------------- config */

    /// @notice Desks that can ever exist.
    uint256 public constant MAX_SUPPLY = 5_000;

    /// @notice Charged by `mint`, on top of the burned deposit.
    uint256 public constant SURCHARGE = 0.01 ether;

    /// @notice The protocol's only revenue: a tenth of the surcharge.
    uint256 public constant PROTOCOL_CUT = 0.001 ether;

    /// @notice A round fires the moment the pot clears this.
    /// @dev A fifth of the surcharge, so one mint funds one round. Raising it
    ///      makes rounds rarer and chunkier, which costs the keeper less gas
    ///      per unit bought; lowering it makes them more frequent and smaller.
    uint256 public constant ROUND_THRESHOLD = 0.002 ether;

    /// @notice Declared on the collection, paid to the pot, not to us.
    uint96 public constant ROYALTY_BPS = 500;

    /// @dev Tokens that reject transfers to address(0) still accept this one.
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    /// @dev Fixed-point scale for the accumulators.
    uint256 private constant ACC = 1e18;

    /// @notice Burned by every mint.
    IERC20 public immutable depositToken;

    /// @notice How much of it. Set at deploy, since decimals vary.
    uint256 public immutable depositAmount;

    /// @notice Clone target for every desk vault.
    address public immutable vaultImplementation;

    /* ----------------------------------------------------------------- state */

    /// @notice The ten tokenised assets, taken strictly in order.
    IERC20[] public rotation;

    /// @notice Which asset the next round buys.
    uint256 public nextAsset;

    /// @notice Desks issued so far. Also the divisor a round splits by.
    uint256 public totalMinted;

    /// @notice Where the protocol's cut goes.
    address public protocolWallet;

    /// @notice The venue a round buys through.
    ISwapAdapter public swapAdapter;

    /// @notice Deployed vault per desk. Zero until the first claim.
    mapping(uint256 tokenId => address vault) public vaultOf;

    /// @notice Units of each asset credited to every desk, ever, scaled by ACC.
    uint256[] public accPerDesk;

    /// @notice Round remainder, carried forward so no dust is lost.
    uint256[] public carry;

    /// @notice How far each desk has been paid, per asset, scaled by ACC.
    mapping(uint256 tokenId => mapping(uint256 assetIndex => uint256)) public stamp;

    /// @notice Rounds settled.
    uint256 public roundCount;

    /// @notice Native currency converted across every round.
    uint256 public totalConverted;

    string private _baseTokenURI;

    /* ---------------------------------------------------------------- events */

    event Minted(uint256 indexed tokenId, address indexed to, uint256 burned);
    event Activated(uint256 indexed tokenId, address vault);
    event RoundFired(
        uint256 indexed round,
        uint256 indexed assetIndex,
        address asset,
        uint256 spent,
        uint256 bought,
        uint256 desks
    );
    event Claimed(uint256 indexed tokenId, address indexed vault, uint256 assetIndex, uint256 amount);
    event SwapAdapterSet(address indexed adapter);
    event ProtocolWalletSet(address indexed wallet);
    event BaseURISet(string uri);

    /* ---------------------------------------------------------------- errors */

    error SoldOut();
    error WrongSurcharge(uint256 sent, uint256 expected);
    error NoSuchDesk();
    error AlreadyActivated();
    error PotBelowThreshold(uint256 balance, uint256 threshold);
    error NoDesksYet();
    error NothingBought();
    error NoAdapter();
    error ZeroAddress();
    error BadRotation();
    error TransferFailed();

    /* ----------------------------------------------------------- constructor */

    constructor(
        IERC20 depositToken_,
        uint256 depositAmount_,
        address protocolWallet_,
        IERC20[] memory rotation_,
        string memory baseURI_,
        address initialOwner
    ) ERC721("HOODESKS", "DESK") Ownable(initialOwner) {
        if (address(depositToken_) == address(0) || protocolWallet_ == address(0)) revert ZeroAddress();
        if (rotation_.length == 0 || rotation_.length > 32) revert BadRotation();

        depositToken = depositToken_;
        depositAmount = depositAmount_;
        protocolWallet = protocolWallet_;
        _baseTokenURI = baseURI_;

        for (uint256 i; i < rotation_.length; ++i) {
            if (address(rotation_[i]) == address(0)) revert ZeroAddress();
            rotation.push(rotation_[i]);
            accPerDesk.push(0);
            carry.push(0);
        }

        vaultImplementation = address(new DeskVault());
    }

    /* ------------------------------------------------------------------ mint */

    /**
     * @notice Burn the deposit, pay the surcharge, receive a desk.
     * @dev The burn and the mint are the same transaction: there is no state
     *      in which a desk exists and the supply did not go down.
     *
     *      Caller must have approved `depositAmount` of `depositToken` first.
     */
    function mint() external payable nonReentrant returns (uint256 tokenId) {
        if (totalMinted >= MAX_SUPPLY) revert SoldOut();
        if (msg.value != SURCHARGE) revert WrongSurcharge(msg.value, SURCHARGE);

        tokenId = ++totalMinted;

        // Stamp at the current accumulator, so this desk starts owed nothing
        // and cannot reach back into rounds that fired before it existed.
        uint256 n = rotation.length;
        for (uint256 i; i < n; ++i) {
            stamp[tokenId][i] = accPerDesk[i];
        }

        depositToken.safeTransferFrom(msg.sender, BURN_ADDRESS, depositAmount);

        // The rest of the surcharge stays here and is the pot.
        (bool ok, ) = protocolWallet.call{value: PROTOCOL_CUT}("");
        if (!ok) revert TransferFailed();

        _safeMint(msg.sender, tokenId);
        emit Minted(tokenId, msg.sender, depositAmount);
    }

    /* -------------------------------------------------------------- activate */

    /**
     * @notice Deploy a desk's vault. Permissionless — it only ever helps.
     * @dev Not required before a desk earns: entitlement accrues from the
     *      moment it is minted, and `claim` deploys the vault if it is still
     *      missing. Call this only to make the address exist early, so it can
     *      receive an airdrop or be shown in a wallet.
     */
    function activate(uint256 tokenId) public returns (address vault) {
        if (_ownerOf(tokenId) == address(0)) revert NoSuchDesk();
        if (vaultOf[tokenId] != address(0)) revert AlreadyActivated();
        vault = _deployVault(tokenId);
    }

    function _deployVault(uint256 tokenId) internal returns (address vault) {
        vault = Clones.cloneDeterministic(vaultImplementation, bytes32(tokenId));
        DeskVault(payable(vault)).initialize(IERC721(address(this)), tokenId);
        vaultOf[tokenId] = vault;
        emit Activated(tokenId, vault);
    }

    /// @notice The vault address a desk will have, before it is deployed.
    function predictVault(uint256 tokenId) external view returns (address) {
        return Clones.predictDeterministicAddress(vaultImplementation, bytes32(tokenId), address(this));
    }

    /* ----------------------------------------------------------------- round */

    /**
     * @notice Spend the whole pot on the next asset and credit every desk an
     *         equal share. Permissionless.
     *
     * @param minAmountOut slippage floor, computed off chain by the caller.
     *        Left to the caller because this contract has no price oracle; a
     *        keeper passing zero is inviting a sandwich.
     *
     * @dev One transaction regardless of how many desks exist, because it
     *      writes one accumulator rather than paying each vault. Delivery is
     *      a separate, lazy step — see `claim`.
     */
    function fireRound(uint256 minAmountOut) external nonReentrant returns (uint256 bought) {
        if (address(swapAdapter) == address(0)) revert NoAdapter();
        if (totalMinted == 0) revert NoDesksYet();

        uint256 amount = address(this).balance;
        if (amount < ROUND_THRESHOLD) revert PotBelowThreshold(amount, ROUND_THRESHOLD);

        uint256 index = nextAsset;
        IERC20 asset = rotation[index];

        // Measure rather than trust the adapter's return value.
        uint256 before = asset.balanceOf(address(this));
        swapAdapter.swapExactNativeForToken{value: amount}(address(asset), address(this), minAmountOut);
        bought = asset.balanceOf(address(this)) - before;
        if (bought == 0) revert NothingBought();

        // Equal split. The remainder rides along to the next round for this
        // asset rather than being truncated away.
        uint256 numerator = bought * ACC + carry[index];
        accPerDesk[index] += numerator / totalMinted;
        carry[index] = numerator % totalMinted;

        nextAsset = (index + 1) % rotation.length;
        unchecked {
            ++roundCount;
            totalConverted += amount;
        }

        emit RoundFired(roundCount, index, address(asset), amount, bought, totalMinted);
    }

    /* ----------------------------------------------------------------- claim */

    /**
     * @notice Deliver everything a desk is owed into its vault, across every
     *         asset at once. Permissionless, and deploys the vault if needed.
     *
     * @dev Deliberately lazy and batched. A single round credits each desk a
     *      fraction of a cent; delivering that per desk per round would cost
     *      more gas than it moves. Claiming when it is worth claiming, for
     *      all ten assets in one transaction, is the whole point.
     */
    function claim(uint256 tokenId) public nonReentrant returns (uint256 assetsPaid) {
        if (_ownerOf(tokenId) == address(0)) revert NoSuchDesk();

        address vault = vaultOf[tokenId];
        if (vault == address(0)) vault = _deployVault(tokenId);

        uint256 n = rotation.length;
        for (uint256 i; i < n; ++i) {
            uint256 acc = accPerDesk[i];
            uint256 paid = stamp[tokenId][i];
            if (acc <= paid) continue;

            uint256 owed = (acc - paid) / ACC;
            if (owed == 0) continue;

            // Advance only by what was actually paid, so the sub-unit
            // remainder stays owed instead of being rounded away.
            stamp[tokenId][i] = paid + owed * ACC;
            rotation[i].safeTransfer(vault, owed);

            unchecked { ++assetsPaid; }
            emit Claimed(tokenId, vault, i, owed);
        }
    }

    /// @notice Claim for many desks. For keepers.
    function claimMany(uint256[] calldata tokenIds) external {
        for (uint256 i; i < tokenIds.length; ++i) claim(tokenIds[i]);
    }

    /* ----------------------------------------------------------------- views */

    /// @notice What a desk could claim right now, per asset in rotation order.
    function pendingOf(uint256 tokenId) external view returns (uint256[] memory owed) {
        uint256 n = rotation.length;
        owed = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            uint256 acc = accPerDesk[i];
            uint256 paid = stamp[tokenId][i];
            owed[i] = acc > paid ? (acc - paid) / ACC : 0;
        }
    }

    /// @notice Everything the front page needs, in one call.
    function summary()
        external
        view
        returns (
            uint256 minted,
            uint256 supply,
            uint256 pot,
            uint256 rounds,
            uint256 converted,
            uint256 nextAssetIndex,
            address nextAssetToken
        )
    {
        return (
            totalMinted,
            MAX_SUPPLY,
            address(this).balance,
            roundCount,
            totalConverted,
            nextAsset,
            address(rotation[nextAsset])
        );
    }

    function rotationLength() external view returns (uint256) {
        return rotation.length;
    }

    /// @notice The rotation as plain addresses, for the client.
    function rotationTokens() external view returns (address[] memory out) {
        uint256 n = rotation.length;
        out = new address[](n);
        for (uint256 i; i < n; ++i) out[i] = address(rotation[i]);
    }

    /* ------------------------------------------------------------- royalties */

    /// @inheritdoc IERC2981
    function royaltyInfo(uint256, uint256 salePrice)
        external
        view
        override
        returns (address receiver, uint256 amount)
    {
        // Paid to this contract, which is the pot — not to the protocol wallet.
        return (address(this), (salePrice * ROYALTY_BPS) / 10_000);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, IERC165)
        returns (bool)
    {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }

    /* ----------------------------------------------------------------- admin */

    function setSwapAdapter(ISwapAdapter adapter) external onlyOwner {
        if (address(adapter) == address(0)) revert ZeroAddress();
        swapAdapter = adapter;
        emit SwapAdapterSet(address(adapter));
    }

    function setProtocolWallet(address wallet) external onlyOwner {
        if (wallet == address(0)) revert ZeroAddress();
        protocolWallet = wallet;
        emit ProtocolWalletSet(wallet);
    }

    function setBaseURI(string calldata uri) external onlyOwner {
        _baseTokenURI = uri;
        emit BaseURISet(uri);
    }

    /* ------------------------------------------------------------- metadata */

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(_baseTokenURI, tokenId.toString(), ".json");
    }

    /* ---------------------------------------------------------------- intake */

    /// @notice The pot. Royalties and claimed launchpad fees land here.
    receive() external payable {}
}
