// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ISwapAdapter
 * @notice The one thing the protocol delegates: turning the pot's native
 *         currency into a stock token.
 *
 * @dev Kept behind an interface on purpose. The accounting in Hoodesks is
 *      what has to be right and is what gets audited; which venue actually
 *      fills the order is a detail that will change — Uniswap v4 through the
 *      Pons hook today, an aggregator tomorrow. Swapping the adapter must
 *      never require touching the ledger.
 *
 *      An adapter is trusted with the pot for the length of one call, so
 *      whatever is deployed here needs the same scrutiny as the core.
 */
interface ISwapAdapter {
    /**
     * @notice Spend exactly `msg.value` on `token` and send the proceeds to
     *         `recipient`.
     * @param token        the ERC-20 to buy
     * @param recipient    where the bought tokens are delivered
     * @param minAmountOut revert below this; the caller computes it off-chain
     * @return amountOut   tokens actually delivered
     */
    function swapExactNativeForToken(address token, address recipient, uint256 minAmountOut)
        external
        payable
        returns (uint256 amountOut);
}
