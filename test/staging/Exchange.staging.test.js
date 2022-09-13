const { assert, expect } = require("chai")
const { network, ethers, getNamedAccounts } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")
const { BigNumber } = require("ethers")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Reward Token Exchange", function () {
        let nft, mintPrice
        let staking, exchange
        let deployer, accounts
        let acc1, acc2
        const delay = ms => new Promise(res => setTimeout(res, ms));

        beforeEach(async () => {
            deployer = (await getNamedAccounts()).deployer
            accounts = await ethers.getSigners()
            // await deployments.fixture(["all"])
            nft = await ethers.getContract("SVGNFT", deployer)
            staking = await ethers.getContract("SVGStaking", deployer)
            exchange = await ethers.getContract("RewardTokenExchange", deployer)
            acc1 = accounts[1]
            acc2 = accounts[2]
            // const stakeTx = await staking.stakeAll()
            // await stakeTx.wait(1)
            // await delay(300000) //wait for 5 minutes
            const claimTx = await staking.claimRewards()
            await claimTx.wait(1)
        })

        describe("add liquidity, swap, remove liquidity", function () {
            it("should be able to add liquidity, swap, remove liquidity", async function () {
                const tokenBal = await staking.balanceOf(deployer)
                const ethBal = await ethers.provider.getBalance(deployer)

                const addTokenAmount = tokenBal.div(2)
                const addEthAmount = ethers.utils.parseEther("0.02")

                const approveTx = await staking.approve(exchange.address, addTokenAmount)
                await approveTx.wait(1)
                const addTx = await exchange.addLiquidity(addTokenAmount, { value: addEthAmount })
                await addTx.wait(1)

                const { ethReserveAmount, tokenReserveAmount } = await exchange.getReserves()
                assert.equal(ethReserveAmount.toString(), addEthAmount.toString())
                assert.equal(tokenReserveAmount.toString(), addTokenAmount.toString())

                const ethSwapInput = ethers.utils.parseEther("0.01")
                const { ethReserveAmount: initialEthReserve, tokenReserveAmount: initialTokenReserve } = await exchange.getReserves()
                const { outputAmount: tokenSwapOutput, } = await exchange.getSwapAmount(ethSwapInput, initialEthReserve, initialTokenReserve)
                const swapTx = await exchange.connect(acc1).swapEthForToken(tokenSwapOutput.sub(100), { value: ethSwapInput })
                await swapTx.wait(1)

                const tokenSwapInput = await staking.balanceOf(acc1.address)
                assert.equal(tokenSwapInput.toString(), tokenSwapOutput.toString())
                const { ethReserveAmount: initialEthReserve2, tokenReserveAmount: initialTokenReserve2 } = await exchange.getReserves()
                const { outputAmount: ethSwapOutput, } = await exchange.getSwapAmount(tokenSwapInput, initialTokenReserve2, initialEthReserve2)
                const deployerInitialTokenBalance = await staking.balanceOf(deployer)
                const approveTx2 = await staking.connect(acc1).approve(exchange.address, tokenSwapInput)
                await approveTx2.wait(1)
                const swapTx2 = await exchange.connect(acc1).swapTokenForEth(tokenSwapInput, ethSwapOutput.sub(100))
                await swapTx2.wait(1)

                const ownerEthShare = await exchange.getOwnerShareEth()
                const ownerTokenShare = await exchange.getOwnerShareToken()
                assert(ownerEthShare.gt(BigNumber.from("0")))
                assert(ownerTokenShare.gt(BigNumber.from("0")))

                const withdrawTx = await exchange.ownerWithdraw()
                await withdrawTx.wait(1)
                const newOwnerEthShare = await exchange.getOwnerShareEth()
                const newOwnerTokenShare = await exchange.getOwnerShareToken()
                assert.equal(newOwnerEthShare.toString(), newOwnerTokenShare.toString(), "0")

                const lpBalance = await exchange.balanceOf(deployer)
                const withdrawLpTx = await exchange.removeLiquidity(lpBalance)
                await withdrawLpTx.wait(1)
                const newLpBalance = await exchange.balanceOf(deployer)
                assert.equal(newLpBalance.toString(), "0")
            })
        })
    }) 