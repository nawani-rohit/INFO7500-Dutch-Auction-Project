import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("BasicDutchAuction", function () {
  const numBlocksAuctionOpen = 10;
  const reservePrice = 500;
  const offerPriceDecrement = 50;

  async function deployBasicDAFixture() {
    const [owner, account1, account2] = await ethers.getSigners();

    const BasicDutchAuction = await ethers.getContractFactory(
      "BasicDutchAuction"
    );

    const basicDutchAuction = await BasicDutchAuction.deploy(
      reservePrice,
      numBlocksAuctionOpen,
      offerPriceDecrement
    );

    return { basicDutchAuction, owner, account1, account2 };
  }

  describe("Deployment", function () {
    it("Set the right owner", async function () {
      const { basicDutchAuction, owner, account1 } = await loadFixture(
        deployBasicDAFixture
      );

      expect(await basicDutchAuction.owner()).to.equal(owner.address);
    });

    it("Auction have no winner", async function () {
      const { basicDutchAuction, owner, account1 } = await loadFixture(
        deployBasicDAFixture
      );

      expect(await basicDutchAuction.winner()).to.equal(
        ethers.constants.AddressZero
      );
    });

    it("Set right initialPrice", async function () {
      const { basicDutchAuction, account1 } = await loadFixture(
        deployBasicDAFixture
      );

      const initialPrice =
        reservePrice + numBlocksAuctionOpen * offerPriceDecrement;

      expect(await basicDutchAuction.getCurrentPrice()).to.equal(initialPrice);
    });
  });

  describe("Bids", function () {
    it("Expected current price after 5 blocks", async function () {
      const { basicDutchAuction, account1 } = await loadFixture(
        deployBasicDAFixture
      );

      const initialPrice =
        reservePrice + numBlocksAuctionOpen * offerPriceDecrement;

      const priceAfter5Blocks = initialPrice - 5 * offerPriceDecrement;
      // Mine 5 blocks
      await mine(5);

      expect(await basicDutchAuction.getCurrentPrice()).to.equal(
        priceAfter5Blocks
      );
    });

    it("Reject low bids", async function () {
      const { basicDutchAuction, account1 } = await loadFixture(
        deployBasicDAFixture
      );

      // Mine 1 block
      await mine(1);

      const lowBidPrice =
        reservePrice +
        numBlocksAuctionOpen * offerPriceDecrement -
        offerPriceDecrement * 3;

      await expect(
        basicDutchAuction.connect(account1).bid({
          value: lowBidPrice,
        })
      ).to.be.revertedWith("The wei value sent is not acceptable");

      await expect(
        basicDutchAuction.connect(account1).bid({
          value: 50,
        })
      ).to.be.revertedWith("The wei value sent is not acceptable");
    });

    it("Bids are higher than currentPrice and set winner as bidder's address", async function () {
      const { basicDutchAuction, account1 } = await loadFixture(
        deployBasicDAFixture
      );
      // Mine 5 blocks
      await mine(5);

      const initialPrice =
        reservePrice + numBlocksAuctionOpen * offerPriceDecrement;
      const highBidPrice = initialPrice - offerPriceDecrement * 4;
      expect(
        await basicDutchAuction.connect(account1).bid({
          value: highBidPrice,
        })
      ).to.not.be.reverted;

      expect(await basicDutchAuction.winner()).to.equal(account1.address);
    });

    it("Reject bids after a winning bid is already accepted", async function () {
      const { basicDutchAuction, account1, account2 } = await loadFixture(
        deployBasicDAFixture
      );
      // Mine 5 blocks
      await mine(5);

      const initialPrice =
        reservePrice + numBlocksAuctionOpen * offerPriceDecrement;
      const highBidPrice = initialPrice - offerPriceDecrement * 4;

      // Bid function should succeed
      expect(
        await basicDutchAuction.connect(account1).bid({
          value: highBidPrice,
        })
      ).to.not.be.reverted;

      // Bid should be rejected
      await expect(
        basicDutchAuction.connect(account2).bid({
          value: highBidPrice,
        })
      ).to.be.revertedWith("Auction has already ended.");
    });

    it("Bids should not be accepted after the auction expires", async function () {
      const { basicDutchAuction, account1, account2 } = await loadFixture(
        deployBasicDAFixture
      );
      // Mine 5 blocks
      await mine(numBlocksAuctionOpen + 1);

      const initialPrice =
        reservePrice + numBlocksAuctionOpen * offerPriceDecrement;
      const highBidPrice = initialPrice - offerPriceDecrement * 4;

      await expect(
        basicDutchAuction.connect(account2).bid({
          value: highBidPrice,
        })
      ).to.be.revertedWith("Auction ended.");
    });

    it("Return reservePrice when max number of auction blocks have elapsed", async function () {
      const { basicDutchAuction, account1, account2 } = await loadFixture(
        deployBasicDAFixture
      );
      // Mine 10 blocks
      await mine(numBlocksAuctionOpen);
      expect(await basicDutchAuction.getCurrentPrice()).to.equal(reservePrice);

      await mine(5);
      expect(await basicDutchAuction.getCurrentPrice()).to.equal(reservePrice);
    });

    it("Send the accepted bid wei value from bidder's account to owner's account", async function () {
      const { basicDutchAuction, owner, account1 } = await loadFixture(
        deployBasicDAFixture
      );
      // Mine 5 blocks
      await mine(5);

      const initialPrice =
        reservePrice + numBlocksAuctionOpen * offerPriceDecrement;
      const highBidPrice = initialPrice - offerPriceDecrement * 4;

      await expect(
        basicDutchAuction.connect(account1).bid({
          value: highBidPrice,
        })
      ).to.changeEtherBalances(
        [account1, owner],
        [-highBidPrice, highBidPrice]
      );
    });
  });
});
