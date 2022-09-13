const { ethers, network } = require("hardhat")

async function mockVrf(requestId, raffle) {
    console.log("We on a local network? Ok let's pretend...")
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
    const nft = await ethers.getContract("SVGNFT")
    await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, nft.address)
    console.log("Responded")
}


mockVrf()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })