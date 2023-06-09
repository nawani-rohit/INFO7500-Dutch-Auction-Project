import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

describe("RandomMusicNFT", function () {
  const TOKEN_URI = "https://www.youtube.com/watch?v=pXRviuL6vMY";

  //Fixture for deploying the NFT
  async function deployNFTFixture() {
    const [owner, account1, account2] = await ethers.getSigners();

    const RandomMusicNFT = await ethers.getContractFactory("RandomMusicNFT");

    const randomMusicNFT = await RandomMusicNFT.deploy();

    return { randomMusicNFT, owner, account1, account2 };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { randomMusicNFT, owner } = await loadFixture(deployNFTFixture);

      expect(await randomMusicNFT.owner()).to.equal(owner.address);
    });

    it("Should allow owner to mint an NFT and emit minting/transfer event", async function () {
      const { randomMusicNFT, owner } = await loadFixture(deployNFTFixture);

      await expect(randomMusicNFT.mintNFT(owner.address, TOKEN_URI))
        .to.emit(randomMusicNFT, "Transfer")
        .withArgs(ethers.constants.AddressZero, owner.address, 0);
    });

    it("Should not allow non-owner addresses to mint an NFT", async function () {
      const { randomMusicNFT, owner, account1 } = await loadFixture(
        deployNFTFixture
      );

      await expect(
        randomMusicNFT.connect(account1).mintNFT(owner.address, TOKEN_URI)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should mint NFT with correct tokenUri", async function () {
      const { randomMusicNFT, owner } = await loadFixture(deployNFTFixture);

      //Mint the NFT
      await randomMusicNFT.mintNFT(owner.address, TOKEN_URI);

      expect(await randomMusicNFT.tokenURI(0)).to.equal(TOKEN_URI);
    });
  });

  describe("Transfers & Approvals", function () {
    it("Should allow owner to transfer the NFT", async function () {
      const { randomMusicNFT, owner, account1 } = await loadFixture(
        deployNFTFixture
      );

      //Mint the NFT
      await randomMusicNFT.mintNFT(owner.address, TOKEN_URI);

      await expect(
        randomMusicNFT.transferFrom(owner.address, account1.address, 0)
      )
        .to.emit(randomMusicNFT, "Transfer")
        .withArgs(owner.address, account1.address, 0);
    });

    it("Should allow recipient to transfer the NFT after receiving the token", async function () {
      const { randomMusicNFT, owner, account1, account2 } = await loadFixture(
        deployNFTFixture
      );

      //Mint the NFT
      await randomMusicNFT.mintNFT(owner.address, TOKEN_URI);

      //Transfer token to account1
      await randomMusicNFT.transferFrom(owner.address, account1.address, 0);

      await expect(
        randomMusicNFT
          .connect(account1)
          .transferFrom(account1.address, account2.address, 0)
      )
        .to.emit(randomMusicNFT, "Transfer")
        .withArgs(account1.address, account2.address, 0);
    });

    it("Should not allow non-token-owning addresses to transfer the NFT unless approved", async function () {
      const { randomMusicNFT, owner, account1, account2 } = await loadFixture(
        deployNFTFixture
      );

      //Mint the NFT
      await randomMusicNFT.mintNFT(owner.address, TOKEN_URI);

      //Transfer token to account1
      await randomMusicNFT.transferFrom(owner.address, account1.address, 0);

      await expect(
        randomMusicNFT
          .connect(account2)
          .transferFrom(account1.address, account2.address, 0)
      ).to.be.revertedWith("ERC721: caller is not token owner or approved");

      await expect(
        randomMusicNFT
          .connect(owner)
          .transferFrom(account1.address, account2.address, 0)
      ).to.be.revertedWith("ERC721: caller is not token owner or approved");
    });

    it("Should allow only token-owner addresses to set ERC721 approvals", async function () {
      const { randomMusicNFT, owner, account1, account2 } = await loadFixture(
        deployNFTFixture
      );

      //Mint the NFT
      await randomMusicNFT.mintNFT(owner.address, TOKEN_URI);

      //Transfer token to account1
      await randomMusicNFT.transferFrom(owner.address, account1.address, 0);

      //Reject approval setting from account2
      await expect(
        randomMusicNFT.connect(account2).approve(account2.address, 0)
      ).to.be.revertedWith(
        "ERC721: approve caller is not token owner or approved for all"
      );

      //Reject approval setting from contract owner
      await expect(
        randomMusicNFT.connect(owner).approve(account2.address, 0)
      ).to.be.revertedWith(
        "ERC721: approve caller is not token owner or approved for all"
      );

      //Allow token holder to set approval
      //Reject approval setting from account2
      await expect(
        randomMusicNFT.connect(account1).approve(account2.address, 0)
      )
        .to.emit(randomMusicNFT, "Approval")
        .withArgs(account1.address, account2.address, 0);
    });

    it("Should allow approved addresses to transfer the NFT", async function () {
      const { randomMusicNFT, owner, account1, account2 } = await loadFixture(
        deployNFTFixture
      );

      //Mint the NFT
      await randomMusicNFT.mintNFT(owner.address, TOKEN_URI);

      //Transfer token to account1
      await randomMusicNFT.transferFrom(owner.address, account1.address, 0);

      //Approve the contract owner to manage account1's transactions
      randomMusicNFT.connect(account1).approve(owner.address, 0);

      //Still won't allow account2 to transfer as it is not approved
      await expect(
        randomMusicNFT
          .connect(account2)
          .transferFrom(account1.address, account2.address, 0)
      ).to.be.revertedWith("ERC721: caller is not token owner or approved");

      //Should allow the approved owner address to transfer the token
      await expect(
        randomMusicNFT
          .connect(owner)
          .transferFrom(account1.address, account2.address, 0)
      )
        .to.emit(randomMusicNFT, "Transfer")
        .withArgs(account1.address, account2.address, 0);
    });
  });
});
