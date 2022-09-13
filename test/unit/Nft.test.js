const { assert, expect } = require("chai")
const { providers, BigNumber, constants } = require("ethers")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("SVG NFT", function () {
        let nft, vrfCoordinatorV2Mock, mintPrice
        let deployer, accounts
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
        })

        describe("constructor", function () {
            it("sets up the mint price and max supply correctly", async () => {
                const mintPriceSet = networkConfig[chainId]['mintPrice']
                assert.equal(mintPriceSet.toString(), mintPrice.toString())

                const maxSupply = await nft.getMaxSupply()
                assert.equal(maxSupply.toString(), "500")
            })
        })

        describe("mint nft", function () {
            it("should fail if incorrect mint fee", async () => {
                await expect(nft.create({ value: mintPrice.sub(1) })).to.be.revertedWithCustomError(nft, "SVGNFT__IncorrectMintPrice")
                await expect(nft.create({ value: mintPrice.add(1) })).to.be.revertedWithCustomError(nft, "SVGNFT__IncorrectMintPrice")
            })

            it("should fail if it has reached max supply", async () => {
                for (let i = 0; i < 500; i++) {
                    let tx = await nft.create({ value: mintPrice })
                    await tx.wait(1)
                }
                await expect(nft.create({ value: mintPrice })).to.be.revertedWithCustomError(nft, "SVGNFT__SoldOut")
            })

            it("be able to mint", async () => {
                await expect(nft.create({ value: mintPrice }))
                    .to.emit(nft, "RequestedRandomSVG")
                    .withArgs(BigNumber.from(1), BigNumber.from(0))
                const currentSupply = await nft.totalSupply()
                const deployerBalance = await nft.balanceOf(deployer)
                assert.equal(currentSupply.toString(), "1")
                assert.equal(deployerBalance.toString(), "1")
            })
        })


        describe("fulfill randomness", function () {
            it("get's a random number and sets the tokenURI for the minted token", async () => {
                const mintTx = await nft.create({ value: mintPrice })
                const receipt = await mintTx.wait(1)
                let requestId = receipt.events[2].args.requestId

                await expect(
                    vrfCoordinatorV2Mock.fulfillRandomWords(requestId, nft.address)
                ).to.emit(nft, "CompletedNFTMint")

                const tokenURI = await nft.tokenURI(0)
                assert(tokenURI.toString().length > 0)
            })
        })

        describe("withdraw funds", function () {
            let deployerInitialBalance, acc2InitialBalance
            let acc1, acc2

            beforeEach(async () => {
                acc1 = accounts[1]
                acc2 = accounts[2]
                const mintTx = await nft.connect(acc1).create({ value: mintPrice })
                await mintTx.wait(1)
                deployerInitialBalance = await accounts[0].getBalance()
            })

            it("would withdraw to owner address even if called by some other address", async () => {
                const withdrawTx = await nft.connect(acc2).withdrawFunds()
                await withdrawTx.wait(1)
                const deployerFinalBalance = await accounts[0].getBalance()
                assert.equal(deployerInitialBalance.add(mintPrice).toString(), deployerFinalBalance.toString())

            })

            it("would withdraw to owner address if called by owner address", async () => {
                const withdrawTx = await nft.withdrawFunds()
                const receipt = await withdrawTx.wait(1)
                const gasUsed = receipt.cumulativeGasUsed.mul(receipt.effectiveGasPrice);
                const deployerFinalBalance = await accounts[0].getBalance()
                assert.equal(deployerInitialBalance.add(mintPrice).toString(), deployerFinalBalance.add(gasUsed).toString())
            })
        })

        describe("lock NFT", function () {
            let acc1, acc2

            beforeEach(async () => {
                acc1 = accounts[1]
                acc2 = accounts[2]
                const mintTx = await nft.connect(acc1).create({ value: mintPrice })
                await mintTx.wait(1)
            })

            it("should fail if account not token owner", async () => {
                await expect(nft.connect(acc2).lockToken(0, acc2.address, false)).to.be.revertedWithCustomError(nft, "Lockable__NotTokenOwner")
            })

            it("should not be able transfer once locked", async () => {
                const lockTx = await nft.connect(acc1).lockToken(0, acc2.address, false)
                await lockTx.wait(1)
                await expect(nft.connect(acc1).transferFrom(acc1.address, acc2.address, 0)).to.be.revertedWithCustomError(nft, "SVGNFT__TokenLocked")
            })

            it("should be able to tansfer once unlocked", async () => {
                const lockTx = await nft.connect(acc1).lockToken(0, acc2.address, false)
                await lockTx.wait(1)
                const unlockTx = await nft.connect(acc2).unlockToken(0)
                await unlockTx.wait(1)
                const transferTx = await nft.connect(acc1).transferFrom(acc1.address, acc2.address, 0)
                await transferTx.wait(1)
                const ownerOfToken = await nft.ownerOf(0)
                assert.equal(ownerOfToken, acc2.address)
            })

        })

        describe("pause contract", function () {
            let acc1

            beforeEach(async () => {
                acc1 = accounts[1]
            })

            it("should be able to pause if owner", async () => {
                const initialState = await nft.isContractPaused()
                const pauseTx = await nft.togglePause()
                await pauseTx.wait(1)
                const finalState = await nft.isContractPaused()
                assert.equal(initialState, false)
                assert.equal(finalState, true)
            })

            it("should not be able to pause if not owner", async () => {
                await expect(nft.connect(acc1).togglePause()).to.be.revertedWithCustomError(nft, "Ownable__NotOwner")
            })

            it("should not be able to mint if contract on pause", async () => {
                const pauseTx = await nft.togglePause()
                await pauseTx.wait(1)
                const pauseBool = await nft.isContractPaused()
                assert.equal(pauseBool, true)
                await expect(nft.create({ value: mintPrice })).to.be.revertedWithCustomError(nft, "SVGNFT__ContractPaused")
            })
        })


        describe("update mint price", function () {

            it("should be able to update mint price if owner", async () => {
                const setMintPrice = ethers.utils.parseEther("0.02")
                const updateTx = await nft.updateMintPrice(setMintPrice)
                await updateTx.wait(1)
                const newMintPrice = await nft.getMintPrice()
                assert.equal(newMintPrice.toString(), setMintPrice.toString())
            })

            it("should not be able to update mint price if not owner", async () => {
                const acc1 = accounts[1]
                const setMintPrice = ethers.utils.parseEther("0.02")
                await expect(nft.connect(acc1).updateMintPrice(setMintPrice)).to.be.revertedWithCustomError(nft, "Ownable__NotOwner")
            })
        })

        describe("update subscription id", function () {

            it("should be able to update subscription id if owner", async () => {
                const setSubId = "1000"
                const updateTx = await nft.updateChainlinkSubscriptionId(setSubId)
                await updateTx.wait(1)
                const newSubId = await nft.getSubscriptionId()
                assert.equal(newSubId.toString(), setSubId)
            })

            it("should not be able to update subscription id if not owner", async () => {
                const acc1 = accounts[1]
                const setSubId = "1000"
                await expect(nft.connect(acc1).updateChainlinkSubscriptionId(setSubId)).to.be.revertedWithCustomError(nft, "Ownable__NotOwner")
            })
        })

    })