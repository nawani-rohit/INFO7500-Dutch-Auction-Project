import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { NFTDutchAuctionERC20Bids } from "../typechain-types/contracts/NFTDutchAuctionERC20Bids";

describe("NFTDutchAuctionERC20Bids", function () {
  const NUM_BLOCKS_AUCTION_OPEN: number = 10;
  const RESERVE_PRICE: number = 500;
  const OFFER_PRICE_DECREMENT: number = 50;
  const NFT_TOKEN_ID: number = 0;
  const TOKEN_URI = "https://www.youtube.com/watch?v=pXRviuL6vMY";

  async function deployNFTDAFixture() {
    const [owner, account1, account2] = await ethers.getSigners();

    //Deploy and mint NFT contract
    const RidiculousDragonsNFT = await ethers.getContractFactory(
      "RidiculousDragonsNFT"
    );
    const ridiculousDragonsNFT = await RidiculousDragonsNFT.deploy();
    await ridiculousDragonsNFT.mintNFT(owner.address, TOKEN_URI);

    //Deploy and mint TMP tokens
    const BnbToken = await ethers.getContractFactory("BnbToken");
    const bnbToken = await BnbToken.deploy();
    await bnbToken.mint(account1.address, 1000);

    const NFTDutchAuctionERC20Bids = await ethers.getContractFactory(
      "NFTDutchAuctionERC20Bids"
    );

    const nftDutchAuctionERC20Bids = await NFTDutchAuctionERC20Bids.deploy(
      bnbToken.address,
      ridiculousDragonsNFT.address,
      NFT_TOKEN_ID,
      RESERVE_PRICE,
      NUM_BLOCKS_AUCTION_OPEN,
      OFFER_PRICE_DECREMENT
    );

    ridiculousDragonsNFT.approve(
      nftDutchAuctionERC20Bids.address,
      NFT_TOKEN_ID
    );

    return {
      ridiculousDragonsNFT,
      bnbToken,
      nftDutchAuctionERC20Bids,
      owner,
      account1,
      account2,
    };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { nftDutchAuctionERC20Bids, owner } = await loadFixture(
        deployNFTDAFixture
      );

      expect(await nftDutchAuctionERC20Bids.auctionOwner()).to.equal(
        owner.address
      );
    });

    it("Should have no winner", async function () {
      const { nftDutchAuctionERC20Bids } = await loadFixture(
        deployNFTDAFixture
      );

      expect(await nftDutchAuctionERC20Bids.auctionWinner()).to.equal(
        ethers.constants.AddressZero
      );
    });

    it("Should not allow Auction creator to deploy contract if the NFT does not belong to them", async function () {
      const { ridiculousDragonsNFT, bnbToken, account1 } = await loadFixture(
        deployNFTDAFixture
      );

      await expect(ridiculousDragonsNFT.mintNFT(account1.address, "Test URI"))
        .to.emit(ridiculousDragonsNFT, "Transfer")
        .withArgs(ethers.constants.AddressZero, account1.address, 1);

      const NFTDutchAuctionERC20Bids = await ethers.getContractFactory(
        "NFTDutchAuctionERC20Bids"
      );
      await expect(
        NFTDutchAuctionERC20Bids.deploy(
          bnbToken.address,
          ridiculousDragonsNFT.address,
          1,
          RESERVE_PRICE,
          NUM_BLOCKS_AUCTION_OPEN,
          OFFER_PRICE_DECREMENT
        )
      ).to.revertedWith(
        "The NFT tokenId does not belong to the Auction's Owner"
      );
    });

    it("Should have the initial price as per Dutch Auction formula", async function () {
      const { nftDutchAuctionERC20Bids } = await loadFixture(
        deployNFTDAFixture
      );

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;

      expect(await nftDutchAuctionERC20Bids.initialPrice()).to.equal(
        initialPrice
      );
    });
  });

  describe("Bids", function () {
    it("Should have expected current price after 5 blocks as per formula", async function () {
      const { nftDutchAuctionERC20Bids } = await loadFixture(
        deployNFTDAFixture
      );

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;

      const priceAfter5Blocks = initialPrice - 5 * OFFER_PRICE_DECREMENT;
      //Mine 5 blocks, since 1 block was already mined
      await mine(5);

      expect(await nftDutchAuctionERC20Bids.getCurrentPrice()).to.equal(
        priceAfter5Blocks
      );
    });

    it("Should reject low bids", async function () {
      const { nftDutchAuctionERC20Bids, account1 } = await loadFixture(
        deployNFTDAFixture
      );

      //Mine 1 block, 1 already mined
      await mine(1);

      const lowBidPrice =
        RESERVE_PRICE +
        NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT -
        OFFER_PRICE_DECREMENT * 5;

      await expect(
        nftDutchAuctionERC20Bids.connect(account1).bid(lowBidPrice)
      ).to.be.revertedWith("The bid amount sent is not acceptable.");

      await expect(
        nftDutchAuctionERC20Bids.connect(account1).bid(50)
      ).to.be.revertedWith("The bid amount sent is not acceptable.");
    });

    it("Should acknowledge bids higher than currentPrice but still fail if proper allowance is not set to the contract's address", async function () {
      const { nftDutchAuctionERC20Bids, bnbToken, account1 } =
        await loadFixture(deployNFTDAFixture);
      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      await expect(
        nftDutchAuctionERC20Bids.connect(account1).bid(highBidPrice)
      ).to.be.revertedWith(
        "Bid failed due to not enough balance/allowance to transfer erc20 token BNB."
      );

      await bnbToken
        .connect(account1)
        .approve(nftDutchAuctionERC20Bids.address, highBidPrice - 10);

      await expect(
        nftDutchAuctionERC20Bids.connect(account1).bid(highBidPrice)
      ).to.be.revertedWith(
        "Bid failed due to not enough balance/allowance to transfer erc20 token BNB."
      );
    });

    it("Should accept bids higher than currentPrice and set winner as bidder's address", async function () {
      const {
        nftDutchAuctionERC20Bids,
        bnbToken,
        ridiculousDragonsNFT,
        owner,
        account1,
      } = await loadFixture(deployNFTDAFixture);

      await ridiculousDragonsNFT
        .connect(owner)
        .approve(nftDutchAuctionERC20Bids.address, NFT_TOKEN_ID);

      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      await bnbToken
        .connect(account1)
        .approve(nftDutchAuctionERC20Bids.address, highBidPrice);

      await expect(nftDutchAuctionERC20Bids.connect(account1).bid(highBidPrice))
        .to.not.be.reverted;

      expect(await nftDutchAuctionERC20Bids.auctionWinner()).to.equal(
        account1.address
      );
    });

    it("Should reject bids after a winning bid is already accepted", async function () {
      const {
        nftDutchAuctionERC20Bids,
        bnbToken,
        ridiculousDragonsNFT,
        owner,
        account1,
        account2,
      } = await loadFixture(deployNFTDAFixture);

      await ridiculousDragonsNFT
        .connect(owner)
        .approve(nftDutchAuctionERC20Bids.address, NFT_TOKEN_ID);

      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      await bnbToken
        .connect(account1)
        .approve(nftDutchAuctionERC20Bids.address, highBidPrice);

      await expect(nftDutchAuctionERC20Bids.connect(account1).bid(highBidPrice))
        .to.not.be.reverted;

      await expect(
        nftDutchAuctionERC20Bids.connect(account2).bid(highBidPrice)
      ).to.be.revertedWith("Auction has already ended.");
    });

    it("Bids should not be accepted after the auction expires", async function () {
      const { nftDutchAuctionERC20Bids, account1, account2 } =
        await loadFixture(deployNFTDAFixture);
      //mine 5 blocks
      await mine(NUM_BLOCKS_AUCTION_OPEN + 1);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      //Get price after 4 blocks
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      await expect(
        nftDutchAuctionERC20Bids.connect(account2).bid(highBidPrice)
      ).to.be.revertedWith("Auction expired.");
    });

    it("Should return reservePrice when max number of auction blocks have elapsed", async function () {
      const { nftDutchAuctionERC20Bids } = await loadFixture(
        deployNFTDAFixture
      );
      //mine 10 blocks
      await mine(NUM_BLOCKS_AUCTION_OPEN);
      expect(await nftDutchAuctionERC20Bids.getCurrentPrice()).to.equal(
        RESERVE_PRICE
      );

      //Mine 5 more blocks
      await mine(5);
      expect(await nftDutchAuctionERC20Bids.getCurrentPrice()).to.equal(
        RESERVE_PRICE
      );
    });

    it("Should send the accepted bid amount in TMP tokens from bidder's account to owner's account", async function () {
      const {
        nftDutchAuctionERC20Bids,
        bnbToken,
        ridiculousDragonsNFT,
        owner,
        account1,
      } = await loadFixture(deployNFTDAFixture);

      await ridiculousDragonsNFT
        .connect(owner)
        .approve(nftDutchAuctionERC20Bids.address, NFT_TOKEN_ID);

      //mine 5 blocks
      await mine(5);

      const ownerTMP = (await bnbToken.balanceOf(owner.address)).toNumber();
      const bidderTMP = (await bnbToken.balanceOf(account1.address)).toNumber();

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      await bnbToken
        .connect(account1)
        .approve(nftDutchAuctionERC20Bids.address, highBidPrice);

      await expect(nftDutchAuctionERC20Bids.connect(account1).bid(highBidPrice))
        .to.not.be.reverted;

      expect(await bnbToken.balanceOf(owner.address)).to.equal(
        ownerTMP + highBidPrice
      );

      expect(await bnbToken.balanceOf(account1.address)).to.equal(
        bidderTMP - highBidPrice
      );
    });

    it("Should transfer the NFT from Owner's account to Bidder's account", async function () {
      const {
        nftDutchAuctionERC20Bids,
        bnbToken,
        ridiculousDragonsNFT,
        owner,
        account1,
      } = await loadFixture(deployNFTDAFixture);

      await ridiculousDragonsNFT
        .connect(owner)
        .approve(nftDutchAuctionERC20Bids.address, NFT_TOKEN_ID);

      //mine 5 blocks
      await mine(5);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;
      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      await bnbToken
        .connect(account1)
        .approve(nftDutchAuctionERC20Bids.address, highBidPrice);

      //Bid function should succeed and transfer NFT from owner to account1
      await expect(nftDutchAuctionERC20Bids.connect(account1).bid(highBidPrice))
        .to.emit(ridiculousDragonsNFT, "Transfer")
        .withArgs(owner.address, account1.address, NFT_TOKEN_ID);

      expect(await ridiculousDragonsNFT.ownerOf(NFT_TOKEN_ID)).to.equal(
        account1.address
      );
    });

    it("Owner should still own the NFT after the auction expires if there is no winning bid", async function () {
      const {
        nftDutchAuctionERC20Bids,
        ridiculousDragonsNFT,
        owner,
        account2,
      } = await loadFixture(deployNFTDAFixture);
      //mine 5 blocks
      await mine(NUM_BLOCKS_AUCTION_OPEN + 1);

      const initialPrice =
        RESERVE_PRICE + NUM_BLOCKS_AUCTION_OPEN * OFFER_PRICE_DECREMENT;

      const highBidPrice = initialPrice - OFFER_PRICE_DECREMENT * 4;

      await expect(
        nftDutchAuctionERC20Bids.connect(account2).bid(highBidPrice)
      ).to.be.revertedWith("Auction expired.");

      expect(await ridiculousDragonsNFT.ownerOf(NFT_TOKEN_ID)).to.equal(
        owner.address
      );
    });
  });
});
