// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/Base64.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "./SVGFactory.sol";
import "./Lockable.sol";
import "./ERC721C.sol";

// Errors
error SVGNFT__SoldOut();
error SVGNFT__IncorrectMintPrice();
error SVGNFT__PendingRandomNumber();
error SVGNFT__TokenLocked();
error SVGNFT__TransferFailed();
error SVGNFT__ContractPaused();


/**@title An onchain SVG NFT contract
 * @author Swarna Lye
 * @notice This contract is for a verifiably random onchain SVG NFT contract
 * @dev This implements Chainlink VRF V2
 */
contract SVGNFT is
    VRFConsumerBaseV2,
    ERC721C,
    Lockable,
    SVGFactory
{
    bytes32 immutable private keyHash = 0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15;
    uint64 private subscriptionId;
    uint32 immutable private callbackGasLimit = 2500000;
    uint16 immutable private requestConfirmations = 3;
    uint32 immutable private numWords = 1;
    uint256 immutable private maxSupply;
    uint256 private mintPrice;
    VRFCoordinatorV2Interface private COORDINATOR;
    bool private paused = false;

    mapping(uint256 => uint256) public requestIdToTokenId;

    event RequestedRandomSVG(uint256 requestId, uint256 tokenId);
    event CompletedNFTMint(uint256 tokenId, string tokenURI);

    constructor(uint64 _subscriptionId, address _vrfCoordinator, uint256 _mintPrice)
        ERC721C("Random SVG NFT", "rSVGNFT")
        VRFConsumerBaseV2(_vrfCoordinator)
        Lockable(address(this))
        SVGFactory()
    {
        subscriptionId = _subscriptionId;
        COORDINATOR = VRFCoordinatorV2Interface(_vrfCoordinator);
        maxSupply = 500;
        mintPrice = _mintPrice;
    }

    // Function to receive Ether. msg.data must be empty
    receive() external payable {}

    // Fallback function is called when msg.data is not empty
    fallback() external payable {}

    function updateMintPrice(uint256 _mintPrice) external onlyOwner {
        mintPrice = _mintPrice;
    }

    function create() external payable returns (uint256) {
        if (totalSupply() + 1 > maxSupply) {
            revert SVGNFT__SoldOut();
        }
        if (msg.value != mintPrice) {
            revert SVGNFT__IncorrectMintPrice();
        }
        if (paused) {
            revert SVGNFT__ContractPaused();
        }
        uint256 requestId = COORDINATOR.requestRandomWords(
            keyHash,
            subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );
        uint256 tokenId = _owners.length;
        requestIdToTokenId[requestId] = tokenId;
        _mint(msg.sender, 1);
        emit RequestedRandomSVG(requestId, tokenId);
        return requestId;
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomness) internal override {
        uint256 tokenId = requestIdToTokenId[requestId];
        string memory svg = _generateSVG(randomness[0]);
        string memory _imageURI = _svgToImageURI(svg);
        string memory _tokenURI = _formatTokenURI(_imageURI);
        _setTokenURI(tokenId, _tokenURI);
        emit CompletedNFTMint(tokenId, _tokenURI); 
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) public override(ERC721C) {
        if (isTokenLocked(_tokenId) == true) {
            revert SVGNFT__TokenLocked();
        }
        super.transferFrom(_from, _to, _tokenId);
    }


    function withdrawFunds() external {
        (bool sent, ) = owner().call{value: address(this).balance}("");
        if (!sent) {
            revert SVGNFT__TransferFailed();
        }
    }

    function togglePause() external onlyOwner {
        paused = !paused;
    }

    function updateChainlinkSubscriptionId(uint64 _subId) external onlyOwner {
        subscriptionId = _subId;
    }

    function getMaxSupply() external view returns (uint256) {
        return maxSupply;
    }

    function getMintPrice() external view returns (uint256) {
        return mintPrice;
    }

    function isContractPaused() external view returns (bool) {
        return paused;
    }

    function getSubscriptionId() external view returns (uint64) {
        return subscriptionId;
    }
}
