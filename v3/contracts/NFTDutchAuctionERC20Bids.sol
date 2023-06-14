// SPDX-License-Identifier: ISC
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/interfaces/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

contract NFTDutchAuctionERC20Bids {
    address payable public immutable auctionOwner;

    address public immutable erc721TokenAddress;
    address public immutable erc20TokenAddress;
    uint256 public immutable nftTokenId;
    uint256 public immutable reservePrice;
    uint256 public immutable numBlocksAuctionOpen;
    uint256 public immutable offerPriceDecrement;

    IERC721 internal immutable nft;
    IERC20 internal immutable tmpToken;
    uint256 public immutable startBlock;
    uint256 public immutable initialPrice;
    address public auctionWinner;

    constructor(
        address _erc20TokenAddress,
        address _erc721TokenAddress,
        uint256 _nftTokenId,
        uint256 _reservePrice,
        uint256 _numBlocksAuctionOpen,
        uint256 _offerPriceDecrement
    ) {
        auctionOwner = payable(msg.sender);

        erc20TokenAddress = _erc20TokenAddress;
        erc721TokenAddress = _erc721TokenAddress;
        nftTokenId = _nftTokenId;
        reservePrice = _reservePrice;
        numBlocksAuctionOpen = _numBlocksAuctionOpen;
        offerPriceDecrement = _offerPriceDecrement;

        nft = IERC721(erc721TokenAddress);
        tmpToken = IERC20(erc20TokenAddress);

        require(
            nft.ownerOf(_nftTokenId) == auctionOwner,
            "The NFT tokenId does not belong to the Auction's Owner"
        );

        startBlock = block.number;
        initialPrice =
            reservePrice +
            (numBlocksAuctionOpen * offerPriceDecrement);
    }

    function getCurrentPrice() public view returns (uint256) {
        uint256 blocksElapsed = block.number - startBlock;
        if (blocksElapsed >= numBlocksAuctionOpen) {
            return reservePrice;
        } else {
            return initialPrice - (blocksElapsed * offerPriceDecrement);
        }
    }

    function bid(uint256 bidAmount) external returns (address) {
        require(auctionWinner == address(0), "Auction has already ended.");

        require(
            (block.number - startBlock) <= numBlocksAuctionOpen,
            "Auction expired."
        );

        uint256 currentPrice = getCurrentPrice();
        require(
            bidAmount >= currentPrice,
            "The bid amount sent is not acceptable."
        );
        require(
            bidAmount <= tmpToken.allowance(msg.sender, address(this)),
            "Bid failed due to not enough balance/allowance to transfer erc20 token BNB."
        );
        auctionWinner = msg.sender;
        tmpToken.transferFrom(auctionWinner, auctionOwner, bidAmount);
        nft.transferFrom(auctionOwner, auctionWinner, nftTokenId);

        return auctionWinner;
    }
}
