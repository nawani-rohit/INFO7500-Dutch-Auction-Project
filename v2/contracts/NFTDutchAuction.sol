// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/interfaces/IERC721.sol";

contract NFTDutchAuction {
    address payable public immutable auctionOwner;

    address public immutable erc721TokenAddress;
    uint256 public immutable nftTokenId;
    uint256 public immutable reservePrice;
    uint256 public immutable numBlocksAuctionOpen;
    uint256 public immutable offerPriceDecrement;

    IERC721 internal immutable nft;
    uint256 public immutable startBlock;
    uint256 public immutable initialPrice;
    address public auctionWinner;

    constructor(
        address _erc721TokenAddress,
        uint256 _nftTokenId,
        uint256 _reservePrice,
        uint256 _numBlocksAuctionOpen,
        uint256 _offerPriceDecrement
    ) {
        auctionOwner = payable(msg.sender);

        erc721TokenAddress = _erc721TokenAddress;
        nftTokenId = _nftTokenId;
        reservePrice = _reservePrice;
        numBlocksAuctionOpen = _numBlocksAuctionOpen;
        offerPriceDecrement = _offerPriceDecrement;

        nft = IERC721(_erc721TokenAddress);

        require(
            nft.ownerOf(_nftTokenId) == auctionOwner,
            "The NFT tokenId does not belong to the Owner"
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

    function bid() external payable returns (address) {
        require(auctionWinner == address(0), "Auction has already ended.");
        require(
            (block.number - startBlock) <= numBlocksAuctionOpen,
            "Auction ended."
        );

        uint256 currentPrice = getCurrentPrice();
        require(
            msg.value >= currentPrice,
            "The wei value sent is not acceptable."
        );

        auctionWinner = msg.sender;
        auctionOwner.transfer(msg.value);
        nft.transferFrom(auctionOwner, auctionWinner, nftTokenId);

        return auctionWinner;
    }
}
