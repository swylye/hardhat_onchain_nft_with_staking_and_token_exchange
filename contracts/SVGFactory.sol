// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/Base64.sol";

contract SVGFactory {
    uint256 private immutable maxPathCount;
    uint256 private immutable minPathCount;
    uint256 private immutable minPathCommandCount;
    uint256 private immutable maxPathCommandCount;
    uint256 private immutable size;
    string[] private colors;

    constructor() {
        size = 500;
        maxPathCount = 10;
        minPathCount = 5;
        minPathCommandCount = 3;
        maxPathCommandCount = 8;
        colors = [
            "red",
            "blue",
            "green",
            "yellow",
            "black",
            "pink",
            "orange",
            "purple",
            "mediumspringgreen",
            "mediumslateblue",
            "hotpink"
        ];
    }

    function _generateSVG(uint256 randomNumber) internal view returns (string memory finalSVG) {
        uint256 numberOfPaths = (randomNumber % (maxPathCount - minPathCount)) + minPathCount;
        finalSVG = string(
            abi.encodePacked(
                "<svg xmlns='http://www.w3.org/2000/svg' height='",
                uint2str(size),
                "' width='",
                uint2str(size),
                "'>"
            )
        );
        for (uint256 i = 0; i < numberOfPaths; i++) {
            uint256 newRNG = uint256(keccak256(abi.encode(randomNumber, i)));
            string memory pathSVG = _generatePath(newRNG);
            finalSVG = string(abi.encodePacked(finalSVG, pathSVG));
        }
        finalSVG = string(abi.encodePacked(finalSVG, "</svg>"));
        return finalSVG;
    }

    function _generatePath(uint256 randomNumber) internal view returns (string memory pathSVG) {
        uint256 numberOfPathCommands = (randomNumber %
            (maxPathCommandCount - minPathCommandCount)) + 1;
        // uint256 binary = (randomNumber * 3) % 2;
        pathSVG = "<path d='";
        for (uint256 i = 0; i < numberOfPathCommands; i++) {
            uint256 newRNG = uint256(keccak256(abi.encode(randomNumber, size + i)));
            string memory pathCommand;
            if (i == 0) {
                pathCommand = _generatePathCommand(newRNG, true);
            } else {
                pathCommand = _generatePathCommand(newRNG, false);
            }
            pathSVG = string(abi.encodePacked(pathSVG, pathCommand));
        }
        string memory color = colors[randomNumber % colors.length];
        pathSVG = string(abi.encodePacked(pathSVG, "' fill='", color, "'/>"));
        return pathSVG;
    }

    function _generatePathCommand(uint256 randomNumber, bool first)
        internal
        view
        returns (string memory pathCommand)
    {
        if (first) {
            pathCommand = "M";
        } else {
            pathCommand = "L";
        }
        uint256 param1 = (uint256(keccak256(abi.encode(randomNumber, size * 3))) % size) + 1;
        uint256 param2 = (uint256(keccak256(abi.encode(randomNumber, size * 4))) % size) + 1;
        pathCommand = string(
            abi.encodePacked(pathCommand, uint2str(param1), " ", uint2str(param2))
        );
    }

    function _svgToImageURI(string memory svg) internal pure returns (string memory) {
        string memory baseURL = "data:image/svg+xml;base64,";
        string memory svgBase64Encoded = Base64.encode(bytes(string(abi.encodePacked(svg))));
        string memory imageURI = string(abi.encodePacked(baseURL, svgBase64Encoded));
        return imageURI;
    }

    function _formatTokenURI(string memory imageURI) internal pure returns (string memory) {
        string memory baseURL = "data:application/json;base64,";
        string memory tokenURL = Base64.encode(
            bytes(
                abi.encodePacked(
                    '{"name":"On-Chain SVG NFT", "description": "A random on-chain SVG NFT created using Chainlink VRF", "attributes": "", "image": "',
                    imageURI,
                    '"}'
                )
            )
        );
        string memory tokenURI = string(abi.encodePacked(baseURL, tokenURL));
        return tokenURI;
    }

    function uint2str(uint256 _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - (_i / 10) * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}
