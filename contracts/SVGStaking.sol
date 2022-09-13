// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./SVGNFT.sol";
import "./OwnableExt.sol";

// Error
error SVGStaking__TokenStaked();
error SVGStaking__TokenLocked();
error SVGStaking__NotTokenOwner();
error SVGStaking__NothingToStake();
error SVGStaking__TokenUnstaked();
error SVGStaking__NothingToUnstake();
error SVGStaking__NothingToClaim();
error SVGStaking__TransferFailed();


contract SVGStaking is ERC20, ReentrancyGuard, OwnableExt {
    SVGNFT nftToken;
    uint256 private rewardPerDay;

    mapping(address => Staker) private addressToStaker;
    mapping(uint256 => bool) private tokenIdStaked;

    struct Staker {
        uint256 stakedAmount;
        uint256[] stakedTokenIdList;
        uint256 lastUpdatedTime;
        uint256 unclaimedRewards;
    }

    constructor(address payable _nftContractAddress)
        ERC20("SVG NFT reward token", "svgNFT")
        ReentrancyGuard()
    {
        nftToken = SVGNFT(_nftContractAddress);
        rewardPerDay = 10 * 10**18;
    }

    // Function to receive Ether. msg.data must be empty
    receive() external payable {}

    // Fallback function is called when msg.data is not empty
    fallback() external payable {}


    function updateRewardAmountPerDay(uint256 _amount) external onlyOwner {
        rewardPerDay = _amount;
    }

    function stake(uint256 _tokenId) external nonReentrant {
        if (tokenIdStaked[_tokenId] == true) {
            revert SVGStaking__TokenStaked();
        }
        if (nftToken.isTokenLocked(_tokenId) == true) {
            revert SVGStaking__TokenLocked();
        }
        if (nftToken.ownerOf(_tokenId) != msg.sender) {
            revert SVGStaking__NotTokenOwner();
        }
        nftToken.lockToken(_tokenId, address(this), true);
        tokenIdStaked[_tokenId] = true;
        addressToStaker[msg.sender].unclaimedRewards += calculateRewards(
            msg.sender
        );
        addressToStaker[msg.sender].stakedAmount += 1;
        addressToStaker[msg.sender].stakedTokenIdList.push(_tokenId);
        addressToStaker[msg.sender].lastUpdatedTime = block.timestamp;
    }

    function stakeAll() external nonReentrant {
        uint256 _nftCount = nftToken.balanceOf(msg.sender);
        if (_nftCount == 0) {
            revert SVGStaking__NothingToStake();
        }
        for (uint256 i = 0; i < _nftCount; i++) {
            uint256 _tokenId = nftToken.tokenOfOwnerByIndex(msg.sender, i);
            if (
                tokenIdStaked[_tokenId] != true &&
                nftToken.isTokenLocked(_tokenId) != true
            ) {
                nftToken.lockToken(_tokenId, address(this), true);
                tokenIdStaked[_tokenId] = true;
                addressToStaker[msg.sender]
                    .unclaimedRewards += calculateRewards(msg.sender);
                addressToStaker[msg.sender].stakedAmount += 1;
                addressToStaker[msg.sender].stakedTokenIdList.push(_tokenId);
                addressToStaker[msg.sender].lastUpdatedTime = block.timestamp;
            }
        }
    }



    function unstake(uint256 _tokenId) external nonReentrant {
        if (tokenIdStaked[_tokenId] != true) {
            revert SVGStaking__TokenUnstaked();
        }
        if (nftToken.ownerOf(_tokenId) != msg.sender) {
            revert SVGStaking__NotTokenOwner();
        }
        addressToStaker[msg.sender].unclaimedRewards += calculateRewards(
            msg.sender
        );
        addressToStaker[msg.sender].stakedAmount -= 1;
        for (
            uint256 i = 0;
            i < addressToStaker[msg.sender].stakedTokenIdList.length;
            i++
        ) {
            if (addressToStaker[msg.sender].stakedTokenIdList[i] == _tokenId) {
                removeFromArray(
                    addressToStaker[msg.sender].stakedTokenIdList,
                    i
                );
            }
        }
        addressToStaker[msg.sender].lastUpdatedTime = block.timestamp;
        tokenIdStaked[_tokenId] = false;
        nftToken.unlockToken(_tokenId);
    }

    function unstakeAll() external nonReentrant {
        if (addressToStaker[msg.sender].stakedTokenIdList.length == 0) {
            revert SVGStaking__NothingToUnstake();
        }
        addressToStaker[msg.sender].unclaimedRewards += calculateRewards(
            msg.sender
        );
        addressToStaker[msg.sender].stakedAmount = 0;
        for (
            uint256 i = 0;
            i < addressToStaker[msg.sender].stakedTokenIdList.length;
            i++
        ) {
            uint256 _tokenId = addressToStaker[msg.sender].stakedTokenIdList[i];
            tokenIdStaked[_tokenId] = false;
            nftToken.unlockToken(_tokenId);
        }
        addressToStaker[msg.sender].stakedTokenIdList = new uint256[](0);
        addressToStaker[msg.sender].lastUpdatedTime = block.timestamp;
    }

    function claimRewards() external nonReentrant {
        uint256 claimableAmount = getAvailableRewards(msg.sender);
        if (claimableAmount == 0) {
            revert SVGStaking__NothingToClaim();
        }
        addressToStaker[msg.sender].unclaimedRewards = 0;
        _mint(msg.sender, claimableAmount);
        addressToStaker[msg.sender].lastUpdatedTime = block.timestamp;
    }

    function withdrawFunds() external payable onlyOwner {
        (bool sent, ) = msg.sender.call{value: address(this).balance}("");
        if (!sent) {
            revert SVGStaking__TransferFailed();
        }
    }

    function removeFromArray(uint256[] storage _array, uint256 _index)
        internal
    {
        _array[_index] = _array[_array.length - 1];
        _array.pop();
    }

    function calculateRewards(address _address)
        public
        view
        returns (uint256 rewardAmount)
    {
        uint256 rewardPerSecond = rewardPerDay / (24 * 60 * 60);
        rewardAmount =
            (block.timestamp - addressToStaker[_address].lastUpdatedTime) *
            addressToStaker[_address].stakedAmount *
            rewardPerSecond;
    }

    function getAvailableRewards(address _address)
        public
        view
        returns (uint256 availableRewards)
    {
        availableRewards =
            addressToStaker[_address].unclaimedRewards +
            calculateRewards(_address);
    }

    function getRewardPerDay() external view returns (uint256) {
        return rewardPerDay;
    }

    function isTokenStaked(uint256 _tokenId) external view returns (bool) {
        return tokenIdStaked[_tokenId];
    }

    function getStakedAmount(address _staker) external view returns (uint256) {
        return addressToStaker[_staker].stakedAmount;
    }

    function getStakedTokenIdList(address _staker)
        external
        view
        returns (uint256[] memory _tokenIdList)
    {
        _tokenIdList = addressToStaker[_staker].stakedTokenIdList;
    }

}
