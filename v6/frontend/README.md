###Basic dutch auction
###Hosted at IPNS url:
https://ipfs.io/ipns/k51qzi5uqu5dk1cgyrxi5ctknxw1zwhyp4kz8viu2ocj1a9kml6ze61txfc4ao

This application demonstrates working of a simple web3 application - A Basic Dutch Auction

The BasicDutchAuction.sol contract works as follows:
The seller instantiates a DutchAuction contract to manage the auction of a single, physical item at a single auction event. The contract is initialized with the following parameters:
reservePrice: the minimum amount of wei that the seller is willing to accept for the item
numBlocksAuctionOpen: the number of blockchain blocks that the auction is open for
offerPriceDecrement: the amount of wei that the auction price should decrease by during each subsequent block.
The seller is the owner of the contract.
The auction begins at the block in which the contract is created.
The initial price of the item is derived from reservePrice, numBlocksAuctionOpen, and offerPriceDecrement: initialPrice = reservePrice + numBlocksAuctionOpen\*offerPriceDecrement
A bid can be submitted by any Ethereum externally-owned account.
The first bid processed by the contract that sends wei greater than or equal to the current price is the winner. The wei should be transferred immediately to the seller and the contract should not accept any more bids. All bids besides the winning bid should be refunded immediately.

The react UI in the /frontend folder provides an interface to interact with the smart contracts on localhost (via hardhat), or sepholia testnet. Supports Metamask wallet.
