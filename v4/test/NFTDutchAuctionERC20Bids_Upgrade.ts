import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { NFTDutchAuctionERC20Bids } from "../typechain-types/contracts/NFTDutchAuctionERC20Bids";

describe("NFTDutchAuctionERC20Bids_Upgrade", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.

  const NUM_BLOCKS_AUCTION_OPEN: number = 10;
  const RESERVE_PRICE: number = 500;
  const OFFER_PRICE_DECREMENT: number = 50;
  const NFT_TOKEN_ID: number = 0;
  const TOKEN_URI = "https://www.youtube.com/watch?v=pXRviuL6vMY";

  async function deployNFTDAUpgradeFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, account1, account2] = await ethers.getSigners();

    //Deploy and mint NFT contract
    const RandomMusicNFT = await ethers.getContractFactory("RandomMusicNFT");
    const randomMusicNFT = await RandomMusicNFT.deploy();
    await randomMusicNFT.mintNFT(owner.address, TOKEN_URI);

    //Deploy and mint TMP tokens
    const TempoToken = await ethers.getContractFactory("TempoToken");
    const tempoToken = await TempoToken.deploy();
    await tempoToken.mint(account1.address, 1000);

    const NFTDutchAuctionERC20Bids = await ethers.getContractFactory(
      "NFTDutchAuctionERC20Bids"
    );

    const nftDutchAuctionERC20Bids = await upgrades.deployProxy(
      NFTDutchAuctionERC20Bids,
      [
        tempoToken.address,
        randomMusicNFT.address,
        NFT_TOKEN_ID,
        RESERVE_PRICE,
        NUM_BLOCKS_AUCTION_OPEN,
        OFFER_PRICE_DECREMENT,
      ]
    );

    const NFTDutchAuctionERC20Bids_v2 = await ethers.getContractFactory(
      "NFTDutchAuctionERC20Bids_v2"
    );
    const nftDutchAuctionERC20Bids_v2 = await upgrades.upgradeProxy(
      nftDutchAuctionERC20Bids.address,
      NFTDutchAuctionERC20Bids_v2
    );

    await randomMusicNFT.approve(
      nftDutchAuctionERC20Bids_v2.address,
      NFT_TOKEN_ID
    );

    return {
      randomMusicNFT,
      tempoToken,
      nftDutchAuctionERC20Bids,
      nftDutchAuctionERC20Bids_v2,
      owner,
      account1,
      account2,
    };
  }

  describe("Upgrade", function () {
    it("Should upgrade contract and return version number which is not present in previous contract", async function () {
      const { nftDutchAuctionERC20Bids, nftDutchAuctionERC20Bids_v2 } =
        await loadFixture(deployNFTDAUpgradeFixture);

      expect(await nftDutchAuctionERC20Bids_v2.getVersion()).to.equal(2);
    });

    it("Should allow multiple upgrades", async function () {
      const { nftDutchAuctionERC20Bids, nftDutchAuctionERC20Bids_v2 } =
        await loadFixture(deployNFTDAUpgradeFixture);

      const NFTDutchAuction_v3 = await ethers.getContractFactory(
        "NFTDutchAuctionERC20Bids"
      );

      const nftDutchAuctionERC20Bids_v3 = await upgrades.upgradeProxy(
        nftDutchAuctionERC20Bids_v2.address,
        NFTDutchAuction_v3
      );
      expect(nftDutchAuctionERC20Bids_v2.address).to.equal(
        nftDutchAuctionERC20Bids_v3.address
      );
    });

    it("Should have same address even after upgrade", async function () {
      const { nftDutchAuctionERC20Bids, nftDutchAuctionERC20Bids_v2 } =
        await loadFixture(deployNFTDAUpgradeFixture);

      console.log(
        "v1 address: " +
          nftDutchAuctionERC20Bids.address +
          " v2 address: " +
          nftDutchAuctionERC20Bids_v2.address
      );
      expect(nftDutchAuctionERC20Bids.address).to.equal(
        nftDutchAuctionERC20Bids_v2.address
      );
    });

    it("Should not allow initialize to be called more than once after upgrade", async function () {
      const { nftDutchAuctionERC20Bids_v2, randomMusicNFT, tempoToken, owner } =
        await loadFixture(deployNFTDAUpgradeFixture);

      await expect(
        nftDutchAuctionERC20Bids_v2.initialize(
          tempoToken.address,
          randomMusicNFT.address,
          NFT_TOKEN_ID,
          RESERVE_PRICE,
          NUM_BLOCKS_AUCTION_OPEN,
          OFFER_PRICE_DECREMENT
        )
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("After upgrade, should have expected current price after 5 blocks as per formula", async function () {
      const { nftDutchAuctionERC20Bids_v2 } = await loadFixture(
        deployNFTDAUpgradeFixture
      );

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;

      const priceAfter5Blocks = initialPrice - 5 * OFFER_PRICE_DECREMENT;
      //Mine 2 blocks, since 3 blocks was already mined
      //when we approved the Auction contract for NFT Transfer
      await mine(2);

      expect(await nftDutchAuctionERC20Bids_v2.getCurrentPrice()).to.equal(
        priceAfter5Blocks
      );
    });

    it("Should reject low bids even after upgrade", async function () {
      const { nftDutchAuctionERC20Bids_v2, account1 } = await loadFixture(
        deployNFTDAUpgradeFixture
      );

      //Mine 1 block, 1 already mined
      //when we approved the Auction contract for NFT Transfer
      await mine(1);

      //This is the Bid price which would be accepted three blocks later
      //But should be rejected now
      const lowBidPrice =
        RESERVE_PRICE +
        NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT -
        OFFER_PRICE_DECREMENT * 7;

      await expect(
        nftDutchAuctionERC20Bids_v2.connect(account1).bid(lowBidPrice)
      ).to.be.revertedWith("The bid amount sent is not acceptable");

      //Test with an arbitrarily low value too
      await expect(
        nftDutchAuctionERC20Bids_v2.connect(account1).bid(50)
      ).to.be.revertedWith("The bid amount sent is not acceptable");
    });

    it("Even after upgrade, Should acknowledge bids higher than currentPrice but still fail if proper allowance is not set to the contract's address", async function () {
      const { nftDutchAuctionERC20Bids_v2, tempoToken, account1 } =
        await loadFixture(deployNFTDAUpgradeFixture);
      //mine 1 block
      await mine(1);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Bid function should succeed
      await expect(
        nftDutchAuctionERC20Bids_v2.connect(account1).bid(highBidPrice)
      ).to.be.revertedWith(
        "Bid amount was accepted, but bid failed as not enough balance/allowance to transfer erc20 token TMP"
      );

      //Approve auction contract to spend less tokens than bid price, should be reverted with same error
      await tempoToken
        .connect(account1)
        .approve(nftDutchAuctionERC20Bids_v2.address, highBidPrice - 10);

      await expect(
        nftDutchAuctionERC20Bids_v2.connect(account1).bid(highBidPrice)
      ).to.be.revertedWith(
        "Bid amount was accepted, but bid failed as not enough balance/allowance to transfer erc20 token TMP"
      );
    });

    it("Should accept bids higher than currentPrice and set winner as bidder's address after upgrade", async function () {
      const { nftDutchAuctionERC20Bids_v2, tempoToken, account1 } =
        await loadFixture(deployNFTDAUpgradeFixture);
      //mine 3 blocks, 2 already mined
      await mine(3);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Set allowance for auction contract to spend bid amount
      await tempoToken
        .connect(account1)
        .approve(nftDutchAuctionERC20Bids_v2.address, highBidPrice);

      //Bid function should succeed
      expect(
        await nftDutchAuctionERC20Bids_v2.connect(account1).bid(highBidPrice)
      ).to.not.be.reverted;

      //Winner should be account1
      expect(await nftDutchAuctionERC20Bids_v2.winner()).to.equal(
        account1.address
      );
    });

    it("Upon upgrading, should reject bids after a winning bid is already accepted", async function () {
      const { nftDutchAuctionERC20Bids_v2, tempoToken, account1, account2 } =
        await loadFixture(deployNFTDAUpgradeFixture);
      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Set allowance for auction contract to spend bid amount
      await tempoToken
        .connect(account1)
        .approve(nftDutchAuctionERC20Bids_v2.address, highBidPrice);

      //Bid function should succeed
      expect(
        await nftDutchAuctionERC20Bids_v2.connect(account1).bid(highBidPrice)
      ).to.not.be.reverted;

      //Bid should be rejected
      await expect(
        nftDutchAuctionERC20Bids_v2.connect(account2).bid(highBidPrice)
      ).to.be.revertedWith("Auction has already concluded");
    });

    it("Bids should not be accepted after the auction expires even after upgrade", async function () {
      const { nftDutchAuctionERC20Bids_v2, account1, account2 } =
        await loadFixture(deployNFTDAUpgradeFixture);
      //mine 5 blocks
      await mine(NUM_BLOCKS_AUCTION_OPEN + 1);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Bid function should fail with auction expired message
      await expect(
        nftDutchAuctionERC20Bids_v2.connect(account2).bid(highBidPrice)
      ).to.be.revertedWith("Auction expired");
    });

    it("Should return reservePrice when max number of auction blocks have elapsed even after upgrade", async function () {
      const { nftDutchAuctionERC20Bids_v2 } = await loadFixture(
        deployNFTDAUpgradeFixture
      );
      //mine 10 blocks
      await mine(NUM_BLOCKS_AUCTION_OPEN);
      //Should return reserve price after 10 blocks are mined
      expect(await nftDutchAuctionERC20Bids_v2.getCurrentPrice()).to.equal(
        RESERVE_PRICE
      );

      //Mine 5 more blocks
      await mine(5);
      //Should return reserve price after 15 blocks are mined
      expect(await nftDutchAuctionERC20Bids_v2.getCurrentPrice()).to.equal(
        RESERVE_PRICE
      );
    });

    it("Even after upgrade, Should send the accepted bid amount in TMP tokens from bidder's account to owner's account", async function () {
      const { nftDutchAuctionERC20Bids_v2, tempoToken, owner, account1 } =
        await loadFixture(deployNFTDAUpgradeFixture);
      //mine 5 blocks
      await mine(5);

      //Amount of TMP in owner's account
      const ownerTMP: number = (
        await tempoToken.balanceOf(owner.address)
      ).toNumber();
      //Amount of TMP in bidder's account
      const bidderTMP: number = (
        await tempoToken.balanceOf(account1.address)
      ).toNumber();

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Set allowance for auction contract to spend bid amount
      await tempoToken
        .connect(account1)
        .approve(nftDutchAuctionERC20Bids_v2.address, highBidPrice);

      //Bid function should succeed
      await expect(
        nftDutchAuctionERC20Bids_v2.connect(account1).bid(highBidPrice)
      ).to.not.be.reverted;

      //Owner's TMP balance should be sum of previous balance & bid amount
      expect(await tempoToken.balanceOf(owner.address)).to.equal(
        ownerTMP + highBidPrice
      );

      //Bidder's TMP balance should be difference of previous balance & bid amount
      expect(await tempoToken.balanceOf(account1.address)).to.equal(
        bidderTMP - highBidPrice
      );
    });

    it("Should transfer the NFT from Owner's account to Bidder's account even after upgrade", async function () {
      const {
        nftDutchAuctionERC20Bids_v2,
        tempoToken,
        randomMusicNFT,
        owner,
        account1,
      } = await loadFixture(deployNFTDAUpgradeFixture);
      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Set allowance for auction contract to spend bid amount
      await tempoToken
        .connect(account1)
        .approve(nftDutchAuctionERC20Bids_v2.address, highBidPrice);

      //Bid function should succeed and teansfer NFT from account1 to owner
      await expect(
        nftDutchAuctionERC20Bids_v2.connect(account1).bid(highBidPrice)
      )
        .to.emit(randomMusicNFT, "Transfer")
        .withArgs(owner.address, account1.address, NFT_TOKEN_ID);

      //NFT contract should reflect the NFT ownership in account1's address

      expect(await randomMusicNFT.ownerOf(NFT_TOKEN_ID)).to.equal(
        account1.address
      );
    });

    it("Owner should still own the NFT after the auction expires if there is no winning bid even after upgrade", async function () {
      const { nftDutchAuctionERC20Bids_v2, randomMusicNFT, owner, account2 } =
        await loadFixture(deployNFTDAUpgradeFixture);
      //mine 5 blocks
      await mine(NUM_BLOCKS_AUCTION_OPEN + 1);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      //Bid function should fail with auction expired message
      await expect(
        nftDutchAuctionERC20Bids_v2.connect(account2).bid(highBidPrice)
      ).to.be.revertedWith("Auction expired");

      //NFT should still belong to owner
      expect(await randomMusicNFT.ownerOf(NFT_TOKEN_ID)).to.equal(
        owner.address
      );
    });
  });
});
