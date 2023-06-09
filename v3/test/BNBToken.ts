import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { TempoToken } from "../typechain-types/contracts/TempoToken";

describe("TempoToken", function () {
  //Fixture for deploying the NFT
  async function deployTokenFixture() {
    const [owner, account1, account2] = await ethers.getSigners();

    const TempoToken = await ethers.getContractFactory("TempoToken");

    const tempoToken = await TempoToken.deploy();

    return { tempoToken, owner, account1, account2 };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { tempoToken, owner } = await loadFixture(deployTokenFixture);

      expect(await tempoToken.owner()).to.equal(owner.address);
    });

    it("Should allow owner to mint tokens and emit minting/transfer event", async function () {
      const { tempoToken, owner } = await loadFixture(deployTokenFixture);

      await expect(tempoToken.mint(owner.address, 1000))
        .to.emit(tempoToken, "Transfer")
        .withArgs(ethers.constants.AddressZero, owner.address, 1000);
    });

    it("Should not allow non-owner addresses to mint Tokens", async function () {
      const { tempoToken, owner, account1 } = await loadFixture(
        deployTokenFixture
      );

      await expect(
        tempoToken.connect(account1).mint(owner.address, 1000)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Transfers & Approvals", function () {
    it("Should allow owner to transfer the NFT", async function () {
      const { tempoToken, owner, account1 } = await loadFixture(
        deployTokenFixture
      );

      //Mint the NFT
      await tempoToken.mint(account1.address, 1000);

      await expect(tempoToken.transfer(account1.address, 50))
        .to.emit(tempoToken, "Transfer")
        .withArgs(owner.address, account1.address, 50);
    });

    it("Should not allow non-token-owning addresses to transfer the NFT unless approved", async function () {
      const { tempoToken, owner, account1, account2 } = await loadFixture(
        deployTokenFixture
      );

      //Mint the NFT
      await tempoToken.mint(account1.address, 100);

      //Transfer token to account2
      await tempoToken.connect(account1).transfer(account2.address, 50);

      await expect(
        tempoToken
          .connect(account2)
          .transferFrom(account1.address, account2.address, 25)
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("Should allow approved addresses to transfer tokens", async function () {
      const { tempoToken, owner, account1, account2 } = await loadFixture(
        deployTokenFixture
      );

      //Mint the NFT
      await tempoToken.mint(account1.address, 1000);

      //Approve the contract owner to manage account1's transactions
      tempoToken.connect(account1).approve(account2.address, 500);

      //Should allow the approved owner address to transfer the token
      await expect(
        tempoToken
          .connect(account2)
          .transferFrom(account1.address, account2.address, 500)
      )
        .to.emit(tempoToken, "Transfer")
        .withArgs(account1.address, account2.address, 500);
    });
  });
});
