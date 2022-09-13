// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

// Errors
error Lockable__TokenLocked();
error Lockable__TokenNotLocked();
error Lockable__NotTokenOwner();
error Lockable__InvalidController();
error Lockable__NotAuthorized();

abstract contract Lockable {
    IERC721 tokenContract;

    mapping(uint256 => bool) private tokenIdLocked;
    mapping(uint256 => address) private tokenIdController;

    constructor(address _tokenAddress) {
        tokenContract = IERC721(_tokenAddress);
    }

    function lockToken(
        uint256 _tokenId,
        address _controller,
        bool _proxy
    ) public {
        if (tokenIdLocked[_tokenId] == true) {
            revert Lockable__TokenLocked();
        }
        address tokenOwner;
        if (_proxy) {
            tokenOwner = tx.origin;
        } else {
            tokenOwner = msg.sender;
        }
        if (tokenOwner != tokenContract.ownerOf(_tokenId)) {
            revert Lockable__NotTokenOwner();
        }
        if (_controller == address(0)) {
            revert Lockable__InvalidController();
        }
        tokenIdLocked[_tokenId] = true;
        tokenIdController[_tokenId] = _controller;
    }

    function unlockToken(uint256 _tokenId) public {
        if (tokenIdLocked[_tokenId] != true) {
            revert Lockable__TokenNotLocked();
        }
        if (msg.sender != tokenIdController[_tokenId]) {
            revert Lockable__NotAuthorized();
        }
        tokenIdLocked[_tokenId] = false;
        delete tokenIdController[_tokenId];
    }

    function isTokenLocked(uint256 _tokenId) public view returns (bool) {
        return tokenIdLocked[_tokenId];
    }

    function getTokenController(uint256 _tokenId) public view returns (address) {
        return tokenIdController[_tokenId];
    }
}
