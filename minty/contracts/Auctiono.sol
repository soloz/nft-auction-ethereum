//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract Auction {
    struct Listing {
        IERC721 nft;
        uint nftId;
        uint minPrice;
        uint highestBid;
        address highestBidder;
        uint endTime;
        address owner;
    }

    uint nextListingId;
    mapping(uint => Listing) listings;
    mapping(address => uint) balances;

    event Bid(
        address indexed bidder,
        uint listingId,
        uint amount,
        uint timestamp
    );
    event List(
        address indexed lister,
        address indexed nft,
        uint indexed nftId,
        uint listingId,
        uint minPriice,
        uint endTime,
        uint timestamp
    );

    modifier listingExists(uint listingId) {
        require(
            listings[listingId].owner != address(0),
            "listing does not exiist"
        );
        _;
    }

    function onERC721Received(
        address operator,
        address from,
        uint tokenId,
        bytes calldata data
    ) public returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function list(
        address nft,
        uint nftId,
        uint minPrice,
        uint numHours
    ) external {
        IERC721 nftContract = IERC721(nft);
        require(
            nftContract.ownerOf(nftId) == msg.sender,
            "you do not own this nft"
        );
        require(
            nftContract.getApproved(nftId) == address(this),
            "this contract is not approved to access this nft"
        );

        nftContract.safeTransferFrom(msg.sender, address(this), nftId);
        Listing storage listing = listings[nextListingId];

        listing.owner = msg.sender;
        listing.minPrice = minPrice;
        listing.nft = nftContract;
        listing.nftId = nftId;
        listing.endTime = block.timestamp + numHours * 1 hours;
        listing.highestBidder = msg.sender;

        emit List(
            msg.sender,
            nft,
            nftId,
            nextListingId,
            minPrice,
            listing.endTime,
            block.timestamp
        );
        nextListingId++;
    }

    function bid(uint listingId) external payable listingExists(listingId) {
        Listing storage listing = listings[listingId];
        require(
            msg.value >= listing.minPrice,
            "bid must be higher than minimum price"
        );
        require(
            msg.value > listing.highestBid,
            "bid must be higher than current highest bid"
        );
        require(block.timestamp < listing.endTime, "auction is over");

        balances[listing.highestBidder] += listing.highestBid;
        listing.highestBid = msg.value;
        listing.highestBidder = msg.sender;

        emit Bid(msg.sender, listingId, msg.value, block.timestamp);
    }

    function end(uint listingId) external listingExists(listingId) {
        Listing storage listing = listings[listingId];

        require(listing.endTime < block.timestamp, "auction is not over");

        balances[listing.owner] = listing.highestBid;
        listing.nft.safeTransferFrom(
            address(this),
            listing.highestBidder,
            listing.nftId
        );

        delete listings[listingId];
    }

    function getListing(
        uint listingId
    )
        public
        view
        listingExists(listingId)
        returns (address, uint, uint, uint, uint)
    {
        return (
            address(listings[listingId].nft),
            listings[listingId].nftId,
            listings[listingId].highestBid,
            listings[listingId].minPrice,
            listings[listingId].endTime
        );
    }

    function withdrawFunds() external {
        uint256 balance = balances[msg.sender];
        balances[msg.sender] = 0;
        (bool sent, ) = payable(msg.sender).call{value: balance}("");
        require(sent);
    }
}
