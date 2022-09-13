const { assert, expect } = require("chai")
const { network, ethers, getNamedAccounts } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")
const { BigNumber } = require("ethers")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("SVG Staking", function () {
        let nft, mintPrice
        let staking
        let deployer, accounts
        let acc1, acc2
        let tokenId1, tokenId2
        let nftCount
        const chainId = network.config.chainId
        const delay = ms => new Promise(res => setTimeout(res, ms));

        beforeEach(async () => {
            deployer = (await getNamedAccounts()).deployer
            accounts = await ethers.getSigners()
            // await deployments.fixture(["all"])
            nft = await ethers.getContract("SVGNFT", deployer)
            // mintPrice = await nft.getMintPrice()
            // staking = await ethers.getContract("SVGStaking", deployer)
            // for (let i = 0; i < 2; i++) {
            //     let tx = await nft.create({ value: mintPrice })
            //     await tx.wait(1)
            // }
            // await delay(120000)
            staking = await ethers.getContract("SVGStaking", deployer)
            acc1 = accounts[1]
            acc2 = accounts[2]
            tokenId1 = "0"
            tokenId2 = "1"
            nftCount = await nft.balanceOf(deployer)
        })

        describe("stake, unstake and claim reward", function () {
            it("should be able to stake", async function () {
                const stakeTx1 = await staking.stake(tokenId1)
                await stakeTx1.wait(1)
                const isTokenLocked1 = await nft.isTokenLocked(tokenId1)
                const isTokenStaked1 = await staking.isTokenStaked(tokenId1)
                const stakedAmount1 = await staking.getStakedAmount(deployer)
                const stakedTokenId1 = await staking.getStakedTokenIdList(deployer).then(x => x[0])
                assert.equal(isTokenLocked1, isTokenStaked1, true)
                assert.equal(stakedAmount1.toString(), "1")
                assert.equal(stakedTokenId1.toString(), tokenId1)
            })

            it("should be able to stake all", async function () {
                const stakeTx2 = await staking.stakeAll()
                await stakeTx2.wait(1)
                const isTokenLocked2 = await nft.isTokenLocked(tokenId2)
                const isTokenStaked2 = await staking.isTokenStaked(tokenId2)
                const stakedAmount2 = await staking.getStakedAmount(deployer)
                const stakedTokenId2 = await staking.getStakedTokenIdList(deployer).then(x => x[1])
                assert.equal(isTokenLocked2, isTokenStaked2, true)
                assert.equal(stakedAmount2.toString(), nftCount.toString())
                assert.equal(stakedTokenId2.toString(), tokenId2)
            })

            it("should be able to unstake", async function () {
                const unstakeTx1 = await staking.unstake(tokenId1)
                await unstakeTx1.wait(1)
                const isTokenLocked3 = await nft.isTokenLocked(tokenId1)
                const isTokenStaked3 = await staking.isTokenStaked(tokenId1)
                const stakedAmount3 = await staking.getStakedAmount(deployer)
                assert.equal(isTokenLocked3, isTokenStaked3, false)
                assert.equal(stakedAmount3.toString(), nftCount.sub(1).toString())
            })

            it("should be able to unstake all", async function () {
                const unstakeTx2 = await staking.unstakeAll()
                await unstakeTx2.wait(1)
                const isTokenLocked4 = await nft.isTokenLocked(tokenId2)
                const isTokenStaked4 = await staking.isTokenStaked(tokenId2)
                const stakedAmount4 = await staking.getStakedAmount(deployer)
                assert.equal(isTokenLocked4, isTokenStaked4, false)
                assert.equal(stakedAmount4.toString(), "0")
            })

            it("should be able claim reward", async function () {
                const claimTx = await staking.claimRewards()
                await claimTx.wait(1)
                const rewardLeft = await staking.getAvailableRewards(deployer)
                const rewardBalance = await staking.balanceOf(deployer)
                assert.equal(rewardLeft.toString(), "0")
                assert(rewardBalance.gt(BigNumber.from("0")))
            })
        })
    }) 