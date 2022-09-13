const { assert, expect } = require("chai")
const { providers, BigNumber, constants } = require("ethers")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")


!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Reward Token Exchange", function () {
        let nft, mintPrice
        let staking, exchange
        let deployer, accounts
        let acc1, acc2

        beforeEach(async () => {
            deployer = (await getNamedAccounts()).deployer
            accounts = await ethers.getSigners()
            await deployments.fixture(["all"])
            nft = await ethers.getContract("SVGNFT", deployer)
            mintPrice = await nft.getMintPrice()
            staking = await ethers.getContract("SVGStaking", deployer)
            exchange = await ethers.getContract("RewardTokenExchange", deployer)
            for (let i = 0; i < 3; i++) {
                let tx = await nft.create({ value: mintPrice })
                await tx.wait(1)
            }
            const stakeTx = await staking.stakeAll()
            await stakeTx.wait(1)
            acc1 = accounts[1]
            acc2 = accounts[2]
            let WEEK = 1 * 60 * 60 * 24 * 7
            await network.provider.request({
                method: 'evm_increaseTime',
                params: [WEEK],
            })
            const claimTx = await staking.claimRewards()
            await claimTx.wait(1)
        })

        describe("add liquidity", function () {
            it("can add liquidity for the first time", async () => {
                const addTokenAmount = ethers.utils.parseEther("10")
                const addEtherAmount = ethers.utils.parseEther("0.1")
                const approveTx = await staking.approve(exchange.address, addTokenAmount)
                await approveTx.wait(1)
                const addTx = await exchange.addLiquidity(addTokenAmount, { value: addEtherAmount })
                await addTx.wait(1)

                const { ethReserveAmount, tokenReserveAmount } = await exchange.getReserves()
                const lpReceiveAmount = Math.sqrt(addTokenAmount.mul(addEtherAmount))
                const lpAmount = await exchange.balanceOf(deployer)

                assert.equal(addTokenAmount.toString(), tokenReserveAmount.toString())
                assert.equal(addEtherAmount.toString(), ethReserveAmount.toString())
                assert.equal(lpReceiveAmount.toString(), lpAmount.toString())
            })

            it("fails with token add amount is 0", async () => {
                const addEtherAmount = ethers.utils.parseEther("0.1")
                await expect(exchange.addLiquidity(0, { value: addEtherAmount })).to.be.revertedWithCustomError(exchange, "RewardTokenExchange__MustTransferBothTokens")
            })

            it("fails with ether add amount is 0", async () => {
                const addTokenAmount = ethers.utils.parseEther("10")
                const approveTx = await staking.approve(exchange.address, addTokenAmount)
                await approveTx.wait(1)
                await expect(exchange.addLiquidity(addTokenAmount, { value: 0 })).to.be.revertedWithCustomError(exchange, "RewardTokenExchange__MustTransferBothTokens")
            })

            it("can add liquidity to existing pool", async () => {
                const addTokenAmount = ethers.utils.parseEther("10")
                const addEtherAmount = ethers.utils.parseEther("0.1")
                const approveTx = await staking.approve(exchange.address, addTokenAmount)
                await approveTx.wait(1)
                const addTx = await exchange.addLiquidity(addTokenAmount, { value: addEtherAmount })
                await addTx.wait(1)
                const { ethReserveAmount: initialEthReserve, tokenReserveAmount: initialTokenReserve } = await exchange.getReserves()
                const initialLpSupply = await exchange.totalSupply()

                const transferTx = await staking.transfer(acc1.address, addTokenAmount)
                await transferTx.wait(1)
                const approveTx2 = await staking.connect(acc1).approve(exchange.address, addTokenAmount)
                await approveTx2.wait(1)
                const addTx2 = await exchange.connect(acc1).addLiquidity(addTokenAmount, { value: addEtherAmount })
                await addTx2.wait(1)
                const { ethReserveAmount: finalEthReserve, tokenReserveAmount: finalTokenReserve } = await exchange.getReserves()
                const lpAmount = await exchange.balanceOf(acc1.address)

                assert.equal(finalEthReserve.sub(initialEthReserve).toString(), addEtherAmount.toString())
                assert.equal(finalTokenReserve.sub(initialTokenReserve).toString(), addTokenAmount.toString())
                assert.equal(lpAmount.toString(), initialLpSupply.toString())
            })
        })

        describe("remove liquidity", function () {
            let addTokenAmount, addEtherAmount
            let initialLpTokenBalance
            let initialTokenBalance, initialEthBalance

            beforeEach(async () => {
                addTokenAmount = ethers.utils.parseEther("10")
                addEtherAmount = ethers.utils.parseEther("0.1")
                const approveTx = await staking.approve(exchange.address, addTokenAmount)
                await approveTx.wait(1)
                const addTx = await exchange.addLiquidity(addTokenAmount, { value: addEtherAmount })
                await addTx.wait(1)
                initialLpTokenBalance = await exchange.balanceOf(deployer)
                initialTokenBalance = await staking.balanceOf(deployer)
                initialEthBalance = await ethers.provider.getBalance(deployer)
            })

            it("should be able to remove liquidity", async () => {
                const removeTx = await exchange.removeLiquidity(initialLpTokenBalance)
                const removeTxRes = await removeTx.wait(1)
                const txGas = removeTxRes.cumulativeGasUsed.mul(removeTxRes.effectiveGasPrice)
                const finalLpTokenBalance = await exchange.balanceOf(deployer)
                const finalTokenBalance = await staking.balanceOf(deployer)
                const finalEthBalance = await ethers.provider.getBalance(deployer)
                assert.equal(finalLpTokenBalance.toString(), "0")
                assert.equal(addTokenAmount.toString(), finalTokenBalance.sub(initialTokenBalance.toString()))
                assert.equal(addEtherAmount.toString(), finalEthBalance.sub(initialEthBalance).add(txGas).toString())
            })

            it("should fail if address does not have sufficient LP tokens to remove", async () => {
                await expect(exchange.connect(acc1).removeLiquidity(1)).to.be.revertedWithCustomError(exchange, "RewardTokenExchange__InvalidAmount")
            })
        })

        describe("swap tokens", function () {
            beforeEach(async () => {
                addTokenAmount = ethers.utils.parseEther("50")
                addEtherAmount = ethers.utils.parseEther("5")
                const approveTx = await staking.approve(exchange.address, addTokenAmount)
                await approveTx.wait(1)
                const addTx = await exchange.addLiquidity(addTokenAmount, { value: addEtherAmount })
                await addTx.wait(1)
            })

            it("should be able to swap eth for reward tokens", async () => {
                const ethSwapInput = ethers.utils.parseEther("1")
                const { ethReserveAmount: initialEthReserve, tokenReserveAmount: initialTokenReserve } = await exchange.getReserves()
                const { outputAmount: tokenSwapOutput, ownerCut } = await exchange.getSwapAmount(ethSwapInput, initialEthReserve, initialTokenReserve)
                const swapTx = await exchange.connect(acc1).swapEthForToken(tokenSwapOutput.sub(100), { value: ethSwapInput })
                await swapTx.wait(1)
                const { ethReserveAmount: finalEthReserve, tokenReserveAmount: finalTokenReserve } = await exchange.getReserves()
                const acc1TokenBalance = await staking.balanceOf(acc1.address)
                assert.equal(tokenSwapOutput.toString(), acc1TokenBalance.toString())
                assert.equal(finalEthReserve.sub(initialEthReserve).toString(), ethSwapInput.toString())
            })

            it("should fail if reward token output below min specified", async () => {
                const ethSwapInput = ethers.utils.parseEther("1")
                const { ethReserveAmount: initialEthReserve, tokenReserveAmount: initialTokenReserve } = await exchange.getReserves()
                const { outputAmount: tokenSwapOutput, ownerCut } = await exchange.getSwapAmount(ethSwapInput, initialEthReserve, initialTokenReserve)
                await expect(exchange.connect(acc1).swapEthForToken(tokenSwapOutput.add(100), { value: ethSwapInput })).to.be.revertedWithCustomError(exchange, "RewardTokenExchange__InsufficientOutput")
            })

            it("should be able to swap reward tokens for eth", async () => {
                const tokenSwapInput = ethers.utils.parseEther("25")
                const { ethReserveAmount: initialEthReserve, tokenReserveAmount: initialTokenReserve } = await exchange.getReserves()
                const { outputAmount: ethSwapOutput, ownerCut } = await exchange.getSwapAmount(tokenSwapInput, initialTokenReserve, initialEthReserve)
                const deployerInitialTokenBalance = await staking.balanceOf(deployer)
                const approveTx = await staking.approve(exchange.address, tokenSwapInput)
                await approveTx.wait(1)
                const swapTx = await exchange.swapTokenForEth(tokenSwapInput, ethSwapOutput.sub(100))
                await swapTx.wait(1)
                const { ethReserveAmount: finalEthReserve, tokenReserveAmount: finalTokenReserve } = await exchange.getReserves()
                const deployerFinalTokenBalance = await staking.balanceOf(deployer)
                assert.equal(deployerInitialTokenBalance.sub(deployerFinalTokenBalance).toString(), tokenSwapInput.toString())
                assert.equal(finalTokenReserve.sub(initialTokenReserve).toString(), tokenSwapInput.toString())
            })

            it("should fail if eth output below min specified", async () => {
                const tokenSwapInput = ethers.utils.parseEther("25")
                const { ethReserveAmount: initialEthReserve, tokenReserveAmount: initialTokenReserve } = await exchange.getReserves()
                const { outputAmount: ethSwapOutput, ownerCut } = await exchange.getSwapAmount(tokenSwapInput, initialTokenReserve, initialEthReserve)
                const approveTx = await staking.approve(exchange.address, tokenSwapInput)
                await approveTx.wait(1)
                await expect(exchange.swapTokenForEth(tokenSwapInput, ethSwapOutput.add(100))).to.be.revertedWithCustomError(exchange, "RewardTokenExchange__InsufficientOutput")
            })
        })

        describe("alter fees", function () {
            it("should be able to alter fees if owner", async () => {
                const initialOwnerFeeCut = await exchange.getOwnerFeeCutPerThousandth()
                const initialLpFeeCut = await exchange.getLpFeeCutPerThousandth()
                const newOwnerFeeCut = '11'
                const newLpFeeCut = '12'
                const alterTx = await exchange.setFee(newOwnerFeeCut, newLpFeeCut)
                await alterTx.wait(1)
                const finalOwnerFeeCut = await exchange.getOwnerFeeCutPerThousandth()
                const finalLpFeeCut = await exchange.getLpFeeCutPerThousandth()
                assert.equal(newOwnerFeeCut, finalOwnerFeeCut.toString())
                assert.equal(newLpFeeCut, finalLpFeeCut.toString())
            })

            it("should fail if not owner", async () => {
                const newOwnerFeeCut = '11'
                const newLpFeeCut = '12'
                await expect(exchange.connect(acc1).setFee(newOwnerFeeCut, newLpFeeCut)).to.be.revertedWithCustomError(exchange, "Ownable__NotOwner")
            })
        })

        describe("owner fee withdrawal", function () {
            beforeEach(async () => {
                addTokenAmount = ethers.utils.parseEther("50")
                addEtherAmount = ethers.utils.parseEther("5")
                const approveTx = await staking.approve(exchange.address, addTokenAmount)
                await approveTx.wait(1)
                const addTx = await exchange.addLiquidity(addTokenAmount, { value: addEtherAmount })
                await addTx.wait(1)

                const ethSwapInput = ethers.utils.parseEther("1")
                const { ethReserveAmount: initialEthReserve1, tokenReserveAmount: initialTokenReserve1 } = await exchange.getReserves()
                const { outputAmount: tokenSwapOutput, } = await exchange.getSwapAmount(ethSwapInput, initialEthReserve1, initialTokenReserve1)
                const swapTx1 = await exchange.connect(acc1).swapEthForToken(tokenSwapOutput.sub(100), { value: ethSwapInput })
                await swapTx1.wait(1)

                const tokenSwapInput = ethers.utils.parseEther("25")
                const { ethReserveAmount: initialEthReserve2, tokenReserveAmount: initialTokenReserve2 } = await exchange.getReserves()
                const { outputAmount: ethSwapOutput, } = await exchange.getSwapAmount(tokenSwapInput, initialTokenReserve2, initialEthReserve2)
                const approveTx2 = await staking.approve(exchange.address, tokenSwapInput)
                await approveTx2.wait(1)
                const swapTx2 = await exchange.swapTokenForEth(tokenSwapInput, ethSwapOutput.sub(100))
                await swapTx2.wait(1)
            })

            it("should be able to withdraw if owner", async () => {
                const initalEthBalance = await ethers.provider.getBalance(deployer)
                const initialTokenBalance = await staking.balanceOf(deployer)
                const ethShare = await exchange.getOwnerShareEth()
                const tokenShare = await exchange.getOwnerShareToken()
                const withdrawTx = await exchange.ownerWithdraw()
                const txRes = await withdrawTx.wait(1)
                const txGas = txRes.cumulativeGasUsed.mul(txRes.effectiveGasPrice)
                const finalEthBalance = await ethers.provider.getBalance(deployer)
                const finalTokenBalance = await staking.balanceOf(deployer)
                assert.equal(finalEthBalance.add(txGas).sub(initalEthBalance).toString(), ethShare.toString())
                assert.equal(finalTokenBalance.sub(initialTokenBalance).toString(), tokenShare.toString())
            })

            it("should not be able to withdraw if not owner", async () => {
                await expect(exchange.connect(acc1).ownerWithdraw()).to.be.revertedWithCustomError(exchange, "Ownable__NotOwner")
            })
        })
    })