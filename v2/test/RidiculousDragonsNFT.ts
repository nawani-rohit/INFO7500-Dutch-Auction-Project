import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

describe("RidiculousDragonsNFT", function () {
  const TOKEN_URI = "https://www.youtube.com/watch?v=pXRviuL6vMY";

  //Fixture for deploying the NFT
  async function deployNFTFixture() {
    const [owner, account1, account2] = await ethers.getSigners();

    const RidiculousDragonsNFT = await ethers.getContractFactory(
      "RidiculousDragonsNFT"
    );

    const ridiculousDragonsNFT = await RidiculousDragonsNFT.deploy();

    return { ridiculousDragonsNFT, owner, account1, account2 };
  }

  describe("Deployment", function () {
    it("Set the right owner", async function () {
      const { ridiculousDragonsNFT, owner } = await loadFixture(
        deployNFTFixture
      );

      expect(await ridiculousDragonsNFT.owner()).to.equal(owner.address);
    });

    it("Allow owner to mint an NFT and emit minting/transfer event", async function () {
      const { ridiculousDragonsNFT, owner } = await loadFixture(
        deployNFTFixture
      );

      await expect(ridiculousDragonsNFT.mintNFT(owner.address, TOKEN_URI))
        .to.emit(ridiculousDragonsNFT, "Transfer")
        .withArgs(ethers.constants.AddressZero, owner.address, 0);
    });

    it("Allow non-owner addresses not to mint an NFT", async function () {
      const { ridiculousDragonsNFT, owner, account1 } = await loadFixture(
        deployNFTFixture
      );

      await expect(
        ridiculousDragonsNFT.connect(account1).mintNFT(owner.address, TOKEN_URI)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Mint NFT with correct tokenURI", async function () {
      const { ridiculousDragonsNFT, owner } = await loadFixture(
        deployNFTFixture
      );

      await ridiculousDragonsNFT.mintNFT(owner.address, TOKEN_URI);

      expect(await ridiculousDragonsNFT.tokenURI(0)).to.equal(TOKEN_URI);
    });
  });

  describe("Transfers & Approvals", function () {
    it("Allow owner to transfer the NFT", async function () {
      const { ridiculousDragonsNFT, owner, account1 } = await loadFixture(
        deployNFTFixture
      );

      //Mint the NFT
      await ridiculousDragonsNFT.mintNFT(owner.address, TOKEN_URI);

      await expect(
        ridiculousDragonsNFT.transferFrom(owner.address, account1.address, 0)
      )
        .to.emit(ridiculousDragonsNFT, "Transfer")
        .withArgs(owner.address, account1.address, 0);
    });

    it("Allow recipient to transfer the NFT after receiving the token", async function () {
      const { ridiculousDragonsNFT, owner, account1, account2 } =
        await loadFixture(deployNFTFixture);

      //Mint the NFT
      await ridiculousDragonsNFT.mintNFT(owner.address, TOKEN_URI);

      await ridiculousDragonsNFT.transferFrom(
        owner.address,
        account1.address,
        0
      );

      await expect(
        ridiculousDragonsNFT
          .connect(account1)
          .transferFrom(account1.address, account2.address, 0)
      )
        .to.emit(ridiculousDragonsNFT, "Transfer")
        .withArgs(account1.address, account2.address, 0);
    });

    it("Allow non-token-owning addresses not to transfer the NFT unless approved", async function () {
      const { ridiculousDragonsNFT, owner, account1, account2 } =
        await loadFixture(deployNFTFixture);

      //Mint the NFT
      await ridiculousDragonsNFT.mintNFT(owner.address, TOKEN_URI);

      await ridiculousDragonsNFT.transferFrom(
        owner.address,
        account1.address,
        0
      );

      await expect(
        ridiculousDragonsNFT
          .connect(account2)
          .transferFrom(account1.address, account2.address, 0)
      ).to.be.revertedWith("ERC721: caller is not token owner or approved");

      await expect(
        ridiculousDragonsNFT
          .connect(owner)
          .transferFrom(account1.address, account2.address, 0)
      ).to.be.revertedWith("ERC721: caller is not token owner or approved");
    });

    it("Allow only token-owner addresses to set ERC721 approvals", async function () {
      const { ridiculousDragonsNFT, owner, account1, account2 } =
        await loadFixture(deployNFTFixture);

      //Mint the NFT
      await ridiculousDragonsNFT.mintNFT(owner.address, TOKEN_URI);

      //Transfer token to account1
      await ridiculousDragonsNFT.transferFrom(
        owner.address,
        account1.address,
        0
      );

      await expect(
        ridiculousDragonsNFT.connect(account2).approve(account2.address, 0)
      ).to.be.revertedWith(
        "ERC721: approve caller is not token owner or approved for all"
      );

      await expect(
        ridiculousDragonsNFT.connect(owner).approve(account2.address, 0)
      ).to.be.revertedWith(
        "ERC721: approve caller is not token owner or approved for all"
      );

      await expect(
        ridiculousDragonsNFT.connect(account1).approve(account2.address, 0)
      )
        .to.emit(ridiculousDragonsNFT, "Approval")
        .withArgs(account1.address, account2.address, 0);
    });

    it("Should allow approved addresses to transfer the NFT", async function () {
      const { ridiculousDragonsNFT, owner, account1, account2 } =
        await loadFixture(deployNFTFixture);

      //Mint the NFT
      await ridiculousDragonsNFT.mintNFT(owner.address, TOKEN_URI);

      await ridiculousDragonsNFT.transferFrom(
        owner.address,
        account1.address,
        0
      );

      ridiculousDragonsNFT.connect(account1).approve(owner.address, 0);

      await expect(
        ridiculousDragonsNFT
          .connect(account2)
          .transferFrom(account1.address, account2.address, 0)
      ).to.be.revertedWith("ERC721: caller is not token owner or approved");

      await expect(
        ridiculousDragonsNFT
          .connect(owner)
          .transferFrom(account1.address, account2.address, 0)
      )
        .to.emit(ridiculousDragonsNFT, "Transfer")
        .withArgs(account1.address, account2.address, 0);
    });
  });
});
