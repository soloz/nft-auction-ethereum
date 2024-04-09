const { expect } = require("chai");

const getTime = async () => {
  const blockBeforeNumber = await ethers.provider.getBlockNumber();
  const blockBefore = await ethers.provider.getBlock(blockBeforeNumber);
  return blockBefore.timestamp;

}

describe("Auction", function() {
  let auction;
  let minty;
  let addr1;
  let addr2;
  let owner;

  before(async () => {
    [owner, addr1, addr2] = await ethers.getSigners();

    const Minty = await ethers.getContractFactory("Minty");
    minty = await Minty.deploy("Name", "NAM");

    const Auction = await ethers.getContractFactory("Auction");
    auction = await Auction.deploy();

    await minty.deployed();
    await auction.deployed();

    await minty.mintToken(owner.address, "uri");

  });

  describe("Listing", () => {
    it("should revert if not approved for listing", async () => {
      await expect(auction.list(minty, 1, 10, 2)).to.be.reverted;
    });

    it("should revert if not owner of nft", async () => {
      await expect(auction.connect(addr1).list(minty, 1, 10, 2)).to.be.reverted;
    });

    it("should allow listing nft", async () => {
      await minty.approve(auction.address, 1);
      await expect(auction.list(minty.address, 1, 10, 1)).to.emit(auction, "List");
    });

    it("should allow listing 2nd nft", async () => {
      await minty.mintToken(owner.address, "uri2");
      await minty.approve(auction.address, 2);
      await expect(auction.list(minty.address, 2, 100, 2)).to.emit(auction, "List");
    });  

  });

  describe("Bid", () => {
    it("should not allow bid below min price", async () => {
      await expect(auction.connect(addr1).bid(0, {value: 5})).to.be.reverted;
    });

    it("should not allow bid on auction that doesn't exist", async () => {
      await expect(auction.connect(addr1).bid(9, {value: 5})).to.be.reverted;
    });


    it("should allow a valid bid", async () => {
      await expect(auction.connect(addr1).bid(0, {value: 15})).to.be.emit(auction, "Bid");
      const [nftContract, nftId, highestBid, minPrice] = await auction.getListing(0);

      expect(nftContract).to.equal(minty.address);
      expect(nftId).to.equal(1);
      expect(highestBid).to.equal(15);
      expect(minPrice).to.equal(10);

    });

    it("should allow a valid bid", async () => {
      await expect(auction.connect(addr2).bid(0, {value: 50})).to.be.emit(auction, "Bid");
      const [nftContract, nftId, highestBid, minPrice] = await auction.getListing(0);

      expect(nftContract).to.equal(minty.address);
      expect(nftId).to.equal(1);
      expect(highestBid).to.equal(50);
      expect(minPrice).to.equal(10);

    });

    it("should not allow bid on smaller than highest bid", async () => {
      await expect(auction.connect(addr2).bid(0, {value: 12})).to.be.reverted;
    });

    it("should not allow bid on auction that has completed", async () => {
      await ethers.provider.send("evm_mine", [(await getTime()) + 3600]);
      await expect(auction.connect(addr1).bid(0, {value: 3300000})).to.be.reverted;
    });

  });

  describe("Withdraw funds", () => {
    it("should allow previous bidders to withdraw their funds", async () => {
       expect(await auction.connect(addr1).withdrawFunds()).to.changeEtherBalances([addr1, auction], [15, -15]);
    });

    it("should not allow current highest bidder to withdraw their funds", async () => {
      expect(await auction.connect(addr2).withdrawFunds()).to.changeEtherBalances([addr2, auction], [0, 0]);
    });

    it("should not allow owner to withdraw their funds until end() is called", async () => {
      expect(await auction.connect(owner).withdrawFunds()).to.changeEtherBalances([owner, auction], [0, 0]);
    });

  });

  describe("End", () => {
    it("should not allow call to end() if auction is not complete", async () => {
      await expect(auction.end()).to.be.reverted;
    });

    it("should allow call to end() when the auction is finished and should allow transfer of nft", async () => {
      await auction.end(0);
      expect(await minty.ownerOf(1)).to.equal(addr2.address);
    });

    it("should allow call to end() twice", async () => {
      await expect(auction.end(0)).to.be.reverted;
    });

    it("should not allow auction winner to withdraw funds once auction is over", async () => {
      expect(await auction.connect(addr2).withdrawFunds()).to.changeEtherBalances([owner, addr2], [0, -0]);
    });

    it("should allow nft supplier / listing owner to withdraw funds once auction is over", async () => {
      expect(await auction.withdrawFunds()).to.changeEtherBalances([owner, addr2], [50, -50]);
    });

  });
  
});
