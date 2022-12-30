// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol"; // used to request random number
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol"; // used to execute code after random number is requested
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol"; // will uitilize _setTokenURI
import "@openzeppelin/contracts/access/Ownable.sol"; // allows use of onlyOwner modifier
import "hardhat/console.sol";

error IpfsNft__WithdrawFailed();
error IpfsNft__NotEnoughEthToMint();
error IpfsNft__RangeOutOfBounds();

contract IpfsNft is VRFConsumerBaseV2, ERC721URIStorage, Ownable {
    // when we mint an NFT, we will trigger a Chainlink VRF call to get us a random number
    // using that number, we will get a random NFT

    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;

    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    // Type Declarations
    enum Rarities {
        legendary,
        rare,
        uncommon,
        common
    }

    // VRF Helpers
    mapping(uint256 => address) public s_requestIdToSender;

    // NFT Variables
    string[] internal s_tokenUris; // ipfs hashes
    uint256 internal s_tokenCounter = 0;
    uint256 private constant MAX_CHANCE_VALUE = 100;
    uint256 private immutable i_mintFee; // cost to mint an NFT

    // Events
    event NftRequested(uint256 indexed requestId, address requester);
    event NftMinted(Rarities rarity, address nftOwner);

    ////////////////////
    // Main Functions //
    ////////////////////

    /// @notice VRFCoordinatorV2Interface is used to request the random number by calling requestRandomWords()
    /// @notice VRFConsumerBaseV2 will call fulfillRandomWords() after there has been a request for a random number from chainlink VRF.
    constructor(
        address vrfCoordinatorV2,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        string[4] memory tokenUris,
        uint256 mintFee
    ) VRFConsumerBaseV2(vrfCoordinatorV2) ERC721("Neon Pups", "NPup") {
        // chainlink VRF constructor variables
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        i_mintFee = mintFee;
        s_tokenUris = tokenUris;
        // ERC721 constructor variables
    }

    /**
     * @notice Method for requested a random number from Chainlink VRF
     * @return requestId - id mapped to the requesting address, will contain random numbers when returned from vrf
     * @notice This contract does not have visibility into the random number until it is returned
     * in fulfillRandomWords by passing in the request ID associated with the requesting address
     */
    function requestNft() public payable returns (uint256 requestId) {
        if (msg.value < i_mintFee) revert IpfsNft__NotEnoughEthToMint();
        // calling requestRandomWords will trigger chainlink VRF to execute fulfillRandomWords,
        // which is where we will do the actual mint
        requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane, // oracle keyHash / gasLane
            i_subscriptionId, // VRF subcription ID
            REQUEST_CONFIRMATIONS, // # of blocks to wait before VRF responds by calling fulfillRandomWords
            i_callbackGasLimit,
            NUM_WORDS // number of uint256 random values to receive, in an array
        );

        s_requestIdToSender[requestId] = msg.sender; // maps address of caller of this function to a request id
        emit NftRequested(requestId, msg.sender);
    }

    /**
     * @notice Method for processing the received random numbers from Chainlink VRF
     * @param requestId - mapped to the requester's address and contains the random number
     * @param randomWords - array of random words corresponding to request id
     * @notice randomWords is the requester address. it contains an the array of random numbers
     */
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        address nftOwner = s_requestIdToSender[requestId]; // gets recipient address based on requestId
        uint256 newTokenId = s_tokenCounter;
        uint256 moddedRange = randomWords[0] % 100;

        // get rarity
        Rarities rarity = getRarityFromModdedRange(moddedRange);

        s_tokenCounter++;
        // mint NFT
        _safeMint(nftOwner, newTokenId);
        // set token URI
        _setTokenURI(newTokenId, s_tokenUris[uint256(rarity)]); // this will assign a URI that matches the index of the dog breed from the Breed enum
        // emit event for NFT minted
        emit NftMinted(rarity, nftOwner);
    }

    /// @notice for withdrawing minted nft proceeds from contract
    function withdraw() public onlyOwner {
        (bool success, ) = msg.sender.call{value: address(this).balance}("");
        if (!success) revert IpfsNft__WithdrawFailed();
    }

    function _burn(uint256 tokenId) internal override(ERC721URIStorage) {
        super._burn(tokenId);
    }

    ////////////////////
    //   Getter Fxs   //
    ////////////////////

    /**
     * @notice Method for selecting the NFT using the rng modifier.
     * @return OceanType
     * @dev ModdenRange = VRF random number % MAX_CHANCE_VALUE
     */
    function getRarityFromModdedRange(uint256 moddedRange) public pure returns (Rarities) {
        uint256 cumulativeSum = 0;
        uint256[4] memory chanceArray = getChanceArray();

        for (uint256 i = 0; i < chanceArray.length; i++) {
            // check if the value returned by chainlink is greater than current sum by less than followig sum
            if (moddedRange >= cumulativeSum && moddedRange < cumulativeSum + chanceArray[i]) {
                return Rarities(i); // returns the index # from rarities enum
            }
            cumulativeSum += chanceArray[i];
        }
        revert IpfsNft__RangeOutOfBounds();
    }

    // () => array used to calculate rng chances
    function getChanceArray() public pure returns (uint256[4] memory) {
        return [1, 9, 20, MAX_CHANCE_VALUE];
    }

    // () => mint fee
    function getMintFee() public view returns (uint256) {
        return i_mintFee;
    }

    // (index) => uri
    function getTokenUris(uint256 index) public view returns (string memory) {
        return s_tokenUris[index];
    }

    // () => token counter
    function getTokenCounter() public view returns (uint256) {
        return s_tokenCounter;
    }
}
