import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("NFTDutchAuction", function () {
  const NUM_BLOCKS_AUCTION_OPEN = 10;
  const RESERVE_PRICE = 500;
  const OFFER_PRICE_DECREMENT = 50;
  const NFT_TOKEN_ID = 0;
  const TOKEN_URI = "https://www.youtube.com/watch?v=-DbgeLAIo0U&t=12s";

  async function deployNFTDAFixture() {
    const [owner, account1, account2] = await ethers.getSigners();

    const RidiculousDragonsNFT = await ethers.getContractFactory(
      "RidiculousDragonsNFT"
    );
    const ridiculousDragonsNFT = await RidiculousDragonsNFT.deploy();
    await (
      await ridiculousDragonsNFT.mintNFT(owner.address, TOKEN_URI)
    ).to;

    const NFTDutchAuction = await ethers.getContractFactory("NFTDutchAuction");

    const nftDutchAuction = await NFTDutchAuction.deploy(
      ridiculousDragonsNFT.address,
      NFT_TOKEN_ID,
      RESERVE_PRICE,
      NUM_BLOCKS_AUCTION_OPEN,
      OFFER_PRICE_DECREMENT
    );

    ridiculousDragonsNFT.approve(nftDutchAuction.address, NFT_TOKEN_ID);

    return { ridiculousDragonsNFT, nftDutchAuction, owner, account1, account2 };
  }

  describe("Deployment", function () {
    it("Set the right owner", async function () {
      const { nftDutchAuction, owner } = await loadFixture(deployNFTDAFixture);

      expect(await nftDutchAuction.auctionOwner()).to.equal(owner.address);
    });

    it("Auction have no winner", async function () {
      const { nftDutchAuction } = await loadFixture(deployNFTDAFixture);

      expect(await nftDutchAuction.auctionWinner()).to.equal(
        ethers.constants.AddressZero
      );
    });

    it("Auction creator is not allowed to deploy contract if the NFT does not belong to them", async function () {
      const { ridiculousDragonsNFT, account1 } = await loadFixture(
        deployNFTDAFixture
      );

      await expect(ridiculousDragonsNFT.mintNFT(account1.address, "Test URI"))
        .to.emit(ridiculousDragonsNFT, "Transfer")
        .withArgs(ethers.constants.AddressZero, account1.address, 1);

      const NFTDutchAuction = await ethers.getContractFactory(
        "NFTDutchAuction"
      );
      await expect(
        NFTDutchAuction.deploy(
          ridiculousDragonsNFT.address,
          1,
          RESERVE_PRICE,
          NUM_BLOCKS_AUCTION_OPEN,
          OFFER_PRICE_DECREMENT
        )
      ).to.revertedWith("The NFT tokenId does not belong to the Owner");
    });

    it("Initial price should be as per Dutch Auction formula", async function () {
      const { nftDutchAuction } = await loadFixture(deployNFTDAFixture);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;

      expect(await nftDutchAuction.initialPrice()).to.equal(initialPrice);
    });
  });

  describe("Bids", function () {
    it("Expected current price after 5 blocks as per formula", async function () {
      const { nftDutchAuction } = await loadFixture(deployNFTDAFixture);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;

      const priceAfter5Blocks = initialPrice - 5 * OFFER_PRICE_DECREMENT;

      //Mine 5 blocks, since 1 block was already mined
      await mine(4);

      expect(await nftDutchAuction.getCurrentPrice()).to.equal(
        priceAfter5Blocks
      );
    });

    it("Reject low bids", async function () {
      const { nftDutchAuction, account1 } = await loadFixture(
        deployNFTDAFixture
      );

      //Mine 1 block, 1 already mined
      await mine(1);

      const lowBidPrice =
        RESERVE_PRICE +
        NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT -
        OFFER_PRICE_DECREMENT * 5;

      await expect(
        nftDutchAuction.connect(account1).bid({
          value: lowBidPrice,
        })
      ).to.be.revertedWith("The wei value sent is not acceptable.");

      //Test with an arbitrarily low value too
      await expect(
        nftDutchAuction.connect(account1).bid({
          value: 50,
        })
      ).to.be.revertedWith("The wei value sent is not acceptable.");
    });

    it("Bids higher than currentPrice and set winner as bidder's address", async function () {
      const { nftDutchAuction, account1 } = await loadFixture(
        deployNFTDAFixture
      );
      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      expect(
        await nftDutchAuction.connect(account1).bid({
          value: highBidPrice,
        })
      ).to.not.be.reverted;

      expect(await nftDutchAuction.auctionWinner()).to.equal(account1.address);
    });

    it("Reject bids after a winning bid is already accepted", async function () {
      const { nftDutchAuction, account1, account2 } = await loadFixture(
        deployNFTDAFixture
      );
      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      expect(
        await nftDutchAuction.connect(account1).bid({
          value: highBidPrice,
        })
      ).to.not.be.reverted;

      await expect(
        nftDutchAuction.connect(account2).bid({
          value: highBidPrice,
        })
      ).to.be.revertedWith("Auction has already ended.");
    });

    it("Bids should not be accepted after the auction expires", async function () {
      const { nftDutchAuction, account1, account2 } = await loadFixture(
        deployNFTDAFixture
      );
      //mine 5 blocks
      await mine(NUM_BLOCKS_AUCTION_OPEN + 1);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Bid function should fail with auction expired message
      await expect(
        nftDutchAuction.connect(account2).bid({
          value: highBidPrice,
        })
      ).to.be.revertedWith("Auction ended.");
    });

    it("ReservePrice when max number of auction blocks have elapsed", async function () {
      const { nftDutchAuction } = await loadFixture(deployNFTDAFixture);
      //mine 10 blocks
      await mine(NUM_BLOCKS_AUCTION_OPEN);
      //Should return reserve price after 10 blocks are mined
      expect(await nftDutchAuction.getCurrentPrice()).to.equal(RESERVE_PRICE);

      //Mine 5 more blocks
      await mine(5);
      //Should return reserve price after 15 blocks are mined
      expect(await nftDutchAuction.getCurrentPrice()).to.equal(RESERVE_PRICE);
    });

    it("The accepted bid wei value should be transferred from bidder's account to owner's account", async function () {
      const { nftDutchAuction, owner, account1 } = await loadFixture(
        deployNFTDAFixture
      );
      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      await expect(
        nftDutchAuction.connect(account1).bid({
          value: highBidPrice,
        })
      ).to.changeEtherBalances(
        [account1, owner],
        [-highBidPrice, highBidPrice]
      );
    });

    it("Should transfer the NFT from Owner's account to Bidder's account", async function () {
      const { nftDutchAuction, ridiculousDragonsNFT, owner, account1 } =
        await loadFixture(deployNFTDAFixture);
      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      await expect(
        nftDutchAuction.connect(account1).bid({
          value: highBidPrice,
        })
      )
        .to.emit(ridiculousDragonsNFT, "Transfer")
        .withArgs(owner.address, account1.address, NFT_TOKEN_ID);

      expect(await ridiculousDragonsNFT.ownerOf(NFT_TOKEN_ID)).to.equal(
        account1.address
      );
    });

    it("Owner should still own the NFT in their account if no bidder is present", async function () {
      const { ridiculousDragonsNFT, nftDutchAuction, owner } =
        await loadFixture(deployNFTDAFixture);

      //mine 11 blocks, 1 mined while approving transfer
      await mine(NUM_BLOCKS_AUCTION_OPEN);

      expect(await nftDutchAuction.getCurrentPrice()).to.equal(RESERVE_PRICE);

      expect(await ridiculousDragonsNFT.ownerOf(NFT_TOKEN_ID)).to.equal(
        owner.address
      );
    });
  });
});
