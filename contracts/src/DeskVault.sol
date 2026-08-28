// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title DeskVault
 * @notice One vault per desk. Deployed as a minimal proxy at activation and
 *         owned by the NFT rather than by a wallet: every withdrawal is
 *         checked against `ownerOf(tokenId)` at the moment it is made.
 *
 * @dev This is what makes a desk a desk rather than a picture. Selling the
 *      NFT hands over the vault with everything in it, because nothing here
 *      stores an owner address to update — ownership is read from the
 *      collection on each call.
 *
 *      Clones share the implementation's code, so all state lives in the
 *      proxy and `initialize` stands in for a constructor. It can only ever
 *      run once.
 */
contract DeskVault {
    using SafeERC20 for IERC20;

    /// @notice The collection this vault answers to.
    IERC721 public collection;

    /// @notice The desk that owns this vault.
    uint256 public tokenId;

    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    error AlreadyInitialized();
    error NotDeskOwner();
    error ZeroAddress();

    /**
     * @notice Bind this clone to one desk. Callable once, by the deployer.
     * @param collection_ the NFT collection
     * @param tokenId_    the desk that will own this vault
     */
    function initialize(IERC721 collection_, uint256 tokenId_) external {
        if (address(collection) != address(0)) revert AlreadyInitialized();
        if (address(collection_) == address(0)) revert ZeroAddress();
        collection = collection_;
        tokenId = tokenId_;
    }

    /// @notice The wallet that currently holds this desk.
    function owner() public view returns (address) {
        return collection.ownerOf(tokenId);
    }

    /**
     * @notice Pull tokens out of the vault. Only the current desk holder can.
     * @dev Deliberately not restricted to the rotation: a desk can receive an
     *      airdrop or a stray transfer, and its holder should be able to
     *      recover it without a protocol upgrade.
     */
    function withdraw(IERC20 token, address to, uint256 amount) external {
        if (msg.sender != owner()) revert NotDeskOwner();
        if (to == address(0)) revert ZeroAddress();
        token.safeTransfer(to, amount);
        emit Withdrawn(address(token), to, amount);
    }

    /// @notice Withdraw a token's entire balance.
    function withdrawAll(IERC20 token, address to) external {
        if (msg.sender != owner()) revert NotDeskOwner();
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = token.balanceOf(address(this));
        token.safeTransfer(to, amount);
        emit Withdrawn(address(token), to, amount);
    }

    /// @notice Sweep native currency, should any ever arrive.
    function withdrawNative(address payable to) external {
        if (msg.sender != owner()) revert NotDeskOwner();
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = address(this).balance;
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "native transfer failed");
        emit Withdrawn(address(0), to, amount);
    }

    receive() external payable {}
}
