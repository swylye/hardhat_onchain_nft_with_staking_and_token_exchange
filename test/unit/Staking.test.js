const { assert, expect } = require("chai")
const { providers, BigNumber, constants } = require("ethers")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("SVG Staking", function () {
        let nft, vrfCoordinatorV2Mock, mintPrice
        let staking
        let deployer, accounts
        let acc1, acc2
        const chainId = network.config.chainId

        beforeEach(async () => {
            deployer = (await getNamedAccounts()).deployer
            accounts = await ethers.getSigners()
            await deployments.fixture(["all"])
            nft = await ethers.getContract("SVGNFT", deployer)
            vrfCoordinatorV2Mock = await ethers.getContract(
                "VRFCoordinatorV2Mock",
                deployer
            )
            mintPrice = await nft.getMintPrice()
            staking = await ethers.getContract("SVGStaking", deployer)
            for (let i = 0; i < 3; i++) {
                let tx = await nft.create({ value: mintPrice })
                await tx.wait(1)
            }
            acc1 = accounts[1]
            acc2 = accounts[2]
        })

        describe("constructor", function () {
            it("sets up the reward per day correctly", async () => {
                const rewardPerDaySet = ethers.utils.parseEther("10")
                const rewardPerDay = await staking.getRewardPerDay()
                assert.equal(rewardPerDaySet.toString(), rewardPerDay.toString())
            })
        })

        describe("update reward", function () {
            it("should update reward per day if owner", async () => {
                const newRewardPerDaySet = ethers.utils.parseEther("11")
                const updateTx = await staking.updateRewardAmountPerDay(newRewardPerDaySet)
                await updateTx.wait(1)
                const newRewardPerDay = await staking.getRewardPerDay()
                assert.equal(newRewardPerDay.toString(), newRewardPerDaySet.toString())
            })

            it("should fail to update reward if not owner", async () => {
                const newRewardPerDaySet = ethers.utils.parseEther("11")
                await expect(staking.connect(acc1).updateRewardAmountPerDay(newRewardPerDaySet)).to.be.revertedWithCustomError(staking, "Ownable__NotOwner")
            })
        })

        describe("stake", function () {
            it("should be able to stake and update the relevant details", async () => {
                const tokenId = "0"
                const stakeTx = await staking.stake(tokenId)
                await stakeTx.wait(1)

                const isTokenLocked = await nft.isTokenLocked(tokenId)
                const isTokenStaked = await staking.isTokenStaked(tokenId)
                const stakedAmount = await staking.getStakedAmount(deployer)
                const stakedTokenId = await staking.getStakedTokenIdList(deployer).then(x => x[0])
                assert.equal(isTokenLocked, true)
                assert.equal(isTokenStaked, true)
                assert.equal(stakedAmount.toString(), "1")
                assert.equal(stakedTokenId.toString(), "0")
            })

            it("should fail if token already staked", async () => {
                const tokenId = "0"
                const stakeTx = await staking.stake(tokenId)
                await stakeTx.wait(1)
                await expect(staking.stake(tokenId)).to.be.revertedWithCustomError(staking, "SVGStaking__TokenStaked")
            })

            it("should fail if token locked", async () => {
                const tokenId = "0"
                const lockTx = await nft.lockToken(tokenId, acc1.address, false)
                await lockTx.wait(1)
                await expect(staking.stake(tokenId)).to.be.revertedWithCustomError(staking, "SVGStaking__TokenLocked")
            })

            it("should fail if not token owner", async () => {
                const tokenId = "0"
                await expect(staking.connect(acc1).stake(tokenId)).to.be.revertedWithCustomError(staking, "SVGStaking__NotTokenOwner")
            })
        })

        describe("stake all", function () {
            it("should be able to stake all and update the relevant details", async () => {
                const stakeTx = await staking.stakeAll()
                await stakeTx.wait(1)
                const isToken0Locked = await nft.isTokenLocked("0")
                const isToken0Staked = await staking.isTokenStaked("0")
                const isToken1Locked = await nft.isTokenLocked("1")
                const isToken1Staked = await staking.isTokenStaked("1")
                const isToken2Locked = await nft.isTokenLocked("2")
                const isToken2Staked = await staking.isTokenStaked("2")
                const stakedAmount = await staking.getStakedAmount(deployer)
                const stakedToken0 = await staking.getStakedTokenIdList(deployer).then(x => x[0])
                const stakedToken1 = await staking.getStakedTokenIdList(deployer).then(x => x[1])
                const stakedToken2 = await staking.getStakedTokenIdList(deployer).then(x => x[2])
                assert.equal(isToken0Locked, isToken1Locked, isToken2Locked, true)
                assert.equal(isToken0Staked, isToken1Staked, isToken2Staked, true)
                assert.equal(stakedAmount.toString(), "3")
                assert.equal(stakedToken0.toString(), "0")
                assert.equal(stakedToken1.toString(), "1")
                assert.equal(stakedToken2.toString(), "2")
            })

            it("should fail if address has nothing to stake", async () => {
                await expect(staking.connect(acc1).stakeAll()).to.be.revertedWithCustomError(staking, "SVGStaking__NothingToStake")
            })
        })

        describe("unstake", function () {
            beforeEach(async () => {
                const tokenId = "0"
                const stakeTx = await staking.stake(tokenId)
                await stakeTx.wait(1)
            })

            it("should be able to unstake", async () => {
                const tokenId = "0"
                const unstakeTx = await staking.unstake(tokenId)
                await unstakeTx.wait(1)
                const isTokenLocked = await nft.isTokenLocked(tokenId)
                const isTokenStaked = await staking.isTokenStaked(tokenId)
                const stakedAmount = await staking.getStakedAmount(deployer)
                const rewardAmount = await staking.getAvailableRewards(deployer)
                assert.equal(isTokenLocked, false)
                assert.equal(isTokenStaked, false)
                assert.equal(stakedAmount.toString(), "0")
                assert(rewardAmount.toNumber() > 0)
            })

            it("should fail if token already unstaked", async () => {
                const tokenId = "0"
                const unstakeTx = await staking.unstake(tokenId)
                await unstakeTx.wait(1)
                await expect(staking.unstake(tokenId)).to.be.revertedWithCustomError(staking, "SVGStaking__TokenUnstaked")
            })

            it("should fail if not token owner", async () => {
                const tokenId = "0"
                await expect(staking.connect(acc1).unstake(tokenId)).to.be.revertedWithCustomError(staking, "SVGStaking__NotTokenOwner")
            })
        })

        describe("unstake all", function () {
            it("should be able to unstake all and update the relevant details", async () => {
                const stakeTx = await staking.stake("1")
                await stakeTx.wait(1)
                const unstakeTx = await staking.unstakeAll()
                await unstakeTx.wait(1)

                const isToken0Locked = await nft.isTokenLocked("0")
                const isToken0Staked = await staking.isTokenStaked("0")
                const isToken1Locked = await nft.isTokenLocked("1")
                const isToken1Staked = await staking.isTokenStaked("1")
                const stakedAmount = await staking.getStakedAmount(deployer)
                const stakedListLength = await staking.getStakedTokenIdList(deployer).then(x => x.length)
                const rewardAmount = await staking.getAvailableRewards(deployer)
                assert.equal(isToken0Locked, isToken1Locked, false)
                assert.equal(isToken0Staked, isToken1Staked, false)
                assert.equal(stakedAmount.toString(), stakedListLength.toString(), "0")
                assert(rewardAmount.toNumber() > 0)
            })

            it("should fail if address has nothing to unstake", async () => {
                await expect(staking.connect(acc1).unstakeAll()).to.be.revertedWithCustomError(staking, "SVGStaking__NothingToUnstake")
            })
        })

        describe("claim reward", function () {
            beforeEach(async () => {
                const tokenId = "0"
                const stakeTx = await staking.stake(tokenId)
                await stakeTx.wait(1)
                const unstakeTx = await staking.unstake(tokenId)
                await unstakeTx.wait(1)
            })

            it("should be able to claim reward", async () => {
                const claimTx = await staking.claimRewards()
                await claimTx.wait(1)
                const rewardLeft = await staking.getAvailableRewards(deployer)
                const rewardBalance = await staking.balanceOf(deployer)
                assert.equal(rewardLeft.toString(), "0")
                assert(rewardBalance.toNumber() > 0)
            })

            it("should fail if address has nothing to claim", async () => {
                await expect(staking.connect(acc1).claimRewards()).to.be.revertedWithCustomError(staking, "SVGStaking__NothingToClaim")
            })
        })
    })