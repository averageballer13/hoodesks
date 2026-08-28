// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISwapAdapter} from "../interfaces/ISwapAdapter.sol";
import {MockERC20} from "./MockERC20.sol";

/// @dev Fills at a fixed rate so the accounting can be reasoned about exactly.
contract MockSwapAdapter is ISwapAdapter {
    uint256 public rate; // tokens minted per wei spent

    constructor(uint256 rate_) {
        rate = rate_;
    }

    function setRate(uint256 r) external {
        rate = r;
    }

    function swapExactNativeForToken(address token, address recipient, uint256 minAmountOut)
        external
        payable
        returns (uint256 amountOut)
    {
        amountOut = msg.value * rate;
        require(amountOut >= minAmountOut, "slippage");
        MockERC20(token).mint(recipient, amountOut);
    }
}
