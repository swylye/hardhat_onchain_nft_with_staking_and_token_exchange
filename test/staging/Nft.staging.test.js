const { assert, expect } = require("chai")
const { network, ethers, getNamedAccounts } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")


developmentChains.includes(network.name)
    ? describe.skip
    : describe("SVG NFT", function () {
        let nft, vrfCoordinatorV2Mock, mintPrice
        let deployer, accounts
        const chainId = network.config.chainId
        const delay = ms => new Promise(res => setTimeout(res, ms));

        beforeEach(async () => {
            deployer = (await getNamedAccounts()).deployer
            accounts = await ethers.getSigners()
            // await deployments.fixture(["all"])
            nft = await ethers.getContract("SVGNFT", deployer)
            mintPrice = await nft.getMintPrice()
        })

        describe("fullfill random words", function () {
            it("works with live chainlink keepers and VRF to get a random number", async function () {
                const tokenId = await nft.totalSupply()
                console.log("Minting NFT...")
                const mintTx = await nft.create({ value: mintPrice })
                await mintTx.wait(1)
                console.log("Ok minted successfully, now it's time to wait for it to be completed...")

                await delay(120000)
                console.log("Checking token URI...")
                const tokenURI = await nft.tokenURI(tokenId)
                assert(tokenURI.toString().length > 0)
            })
        })
    }) 