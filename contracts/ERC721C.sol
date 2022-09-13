// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "./OwnableExt.sol";

// Errors
error ERC721C__TokenIdDoesNotExist();
error ERC721C__InvalidAddress();
error ERC721C__IndexOverflow();
error ERC721C__InvalidFromAddress();
error ERC721C__Unauthorized();
error ERC721C__NonErc721RReceiver();
error ERC721C__IndexExceedAddressBalance();
error ERC721C__NotTokenOwner();
error ERC721C__InvalidMintAmount();

abstract contract ERC721C is OwnableExt {
    /*///////////////////////////////////////////////////////////////
                                 ERC721 VARIABLES
    //////////////////////////////////////////////////////////////*/
    // Array which maps token ID to address (index is tokenID)
    address[] internal _owners;

    // Mapping from token ID to approved address
    mapping(uint256 => address) private _tokenApprovals;

    // Mapping from owner to operator approvals
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    /*///////////////////////////////////////////////////////////////
                                 METADATA VARIABLES
    //////////////////////////////////////////////////////////////*/
    string private NAME;
    string private SYMBOL;
    string private baseURI;
    mapping(uint256 => string) private tokenURIs;

    /*///////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    event Transfer(address indexed _from, address indexed _to, uint256 indexed _tokenId);
    event Approval(address indexed _owner, address indexed _approved, uint256 indexed _tokenId);
    event ApprovalForAll(address indexed _owner, address indexed _operator, bool _approved);

    /*///////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier tokenExists(uint256 _tokenId) {
        if (!_exists(_tokenId)) {
            revert ERC721C__TokenIdDoesNotExist();
        }
        _;
    }

    /*///////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor(string memory _name, string memory _symbol) {
        NAME = _name;
        SYMBOL = _symbol;
    }

    /*///////////////////////////////////////////////////////////////
                              ERC165 LOGIC
    //////////////////////////////////////////////////////////////*/

    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
        return
            interfaceId == 0x01ffc9a7 || // ERC165 Interface ID for ERC165
            interfaceId == 0x80ac58cd || // ERC165 Interface ID for ERC721
            interfaceId == 0x780e9d63 || // ERC165 Interface ID for ERC721Enumerable
            interfaceId == 0x5b5e139f; // ERC165 Interface ID for ERC721Metadata
    }

    /*///////////////////////////////////////////////////////////////
                                 METADATA
    //////////////////////////////////////////////////////////////*/
    function name() external view virtual returns (string memory) {
        return NAME;
    }

    function symbol() external view virtual returns (string memory) {
        return SYMBOL;
    }

    function setBaseURI(string memory _baseURIString) external virtual onlyOwner {
        baseURI = _baseURIString;
    }

    function _baseURI() internal view virtual returns (string memory) {
        return baseURI;
    }

    function _setTokenURI(uint256 _tokenId, string memory _tokenURI)
        internal
        virtual
        tokenExists(_tokenId)
    {
        tokenURIs[_tokenId] = _tokenURI;
    }

    function tokenURI(uint256 _tokenId)
        external
        view
        virtual
        tokenExists(_tokenId)
        returns (string memory)
    {
        string memory _tokenURI = tokenURIs[_tokenId];
        string memory _base = _baseURI();

        // If there is no base URI, return the token URI.
        if (bytes(_base).length == 0) {
            return _tokenURI;
        }
        // If there is no token URI, return the base URI concatenated with tokenId.
        if (bytes(_tokenURI).length == 0) {
            return string(abi.encodePacked(_base, _tokenId));
        }
        // If both are set, concatenate the baseURI and tokenURI (via abi.encodePacked).
        if (bytes(_tokenURI).length > 0) {
            return string(abi.encodePacked(_base, _tokenURI));
        }
    }

    function _exists(uint256 _tokenId) internal view virtual returns (bool) {
        return (_tokenId < _owners.length && _owners[_tokenId] != address(1));
    }

    function balanceOf(address _owner) public view virtual returns (uint256) {
        if (_owner == address(0)) {
            revert ERC721C__InvalidAddress();
        }
        uint256 count;
        uint256 supply = _owners.length;
        // Cannot realistically overflow, since we are using uint256
        unchecked {
            for (uint256 i; i < supply; i++) {
                if (_owner == ownerOf(i)) {
                    count += 1;
                }
            }
        }
        return count;
    }

    function ownerOf(uint256 _tokenId) public view virtual returns (address) {
        if (_tokenId >= _owners.length) {
            revert ERC721C__IndexOverflow();
        }
        // Cannot realistically overflow, since we are using uint256
        unchecked {
            for (_tokenId; ; _tokenId++) {
                if (_owners[_tokenId] != address(0)) {
                    return _owners[_tokenId];
                }
            }
        }
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) public virtual tokenExists(_tokenId) {
        if (_from != ownerOf(_tokenId)) {
            revert ERC721C__InvalidFromAddress();
        }
        bool ownerOrApproved = (msg.sender == _from ||
            msg.sender == _tokenApprovals[_tokenId] ||
            _operatorApprovals[_from][msg.sender]);
        if (!ownerOrApproved) {
            revert ERC721C__Unauthorized();
        }

        // delete previous owner's token approval
        delete _tokenApprovals[_tokenId];
        _owners[_tokenId] = _to;

        if (_tokenId > 0 && _owners[_tokenId - 1] == address(0)) {
            _owners[_tokenId - 1] = _from;
        }

        emit Transfer(_from, _to, _tokenId);
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes memory _data
    ) public virtual {
        if (!_checkOnERC721Received(_from, _to, _tokenId, _data)) {
            revert ERC721C__NonErc721RReceiver();
        }
        transferFrom(_from, _to, _tokenId);
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) public virtual {
        safeTransferFrom(_from, _to, _tokenId, "");
    }

    function _checkOnERC721Received(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes memory _data
    ) private returns (bool) {
        if (_to.code.length == 0) return true;

        try IERC721Receiver(_to).onERC721Received(msg.sender, _from, _tokenId, _data) returns (
            bytes4 retval
        ) {
            return retval == IERC721Receiver(_to).onERC721Received.selector;
        } catch (bytes memory reason) {
            if (reason.length == 0) {
                revert ERC721C__NonErc721RReceiver();
            }
            assembly {
                revert(add(32, reason), mload(reason))
            }
        }
    }

    /*///////////////////////////////////////////////////////////////
                              ERC721 ENUMERABLE LOGIC
    //////////////////////////////////////////////////////////////*/

    function totalSupply() public view virtual returns (uint256) {
        return _owners.length - _getBurntCount();
    }

    function tokenByIndex(uint256 _index) external view virtual returns (uint256) {
        if (_index >= (_owners.length - _getBurntCount())) {
            revert ERC721C__IndexOverflow();
        }
        return _index + _getBurntCountBeforeIndex(_index);
    }

    function tokenOfOwnerByIndex(address _owner, uint256 _index)
        external
        view
        virtual
        returns (uint256 tokenId)
    {
        if (_index >= balanceOf(_owner)) {
            revert ERC721C__IndexExceedAddressBalance();
        }
        uint256 count;
        uint256 supply = _owners.length;

        // Cannot realistically overflow, since we are using uint256
        unchecked {
            for (tokenId; tokenId < supply; tokenId++) {
                if (_owner == ownerOf(tokenId)) {
                    if (count == _index) {
                        return tokenId;
                    } else {
                        count += 1;
                    }
                }
            }
        }
    }

    /*///////////////////////////////////////////////////////////////
                                 TOKEN APPROVALS
    //////////////////////////////////////////////////////////////*/

    function approve(address _approved, uint256 _tokenId) external virtual {
        if (msg.sender != ownerOf(_tokenId)) {
            revert ERC721C__NotTokenOwner();
        }
        _tokenApprovals[_tokenId] = _approved;
        emit Approval(msg.sender, _approved, _tokenId);
    }

    function setApprovalForAll(address _operator, bool _approved) external virtual {
        _operatorApprovals[msg.sender][_operator] = _approved;
        emit ApprovalForAll(msg.sender, _operator, _approved);
    }

    function getApproved(uint256 _tokenId) external view virtual returns (address) {
        return _tokenApprovals[_tokenId];
    }

    function isApprovedForAll(address _owner, address _operator)
        external
        view
        virtual
        returns (bool)
    {
        return _operatorApprovals[_owner][_operator];
    }

    /*///////////////////////////////////////////////////////////////
                       INTERNAL MINT/ BURN LOGIC
    //////////////////////////////////////////////////////////////*/

    function _safeMint(address _to, uint256 _amount) internal virtual {
        _safeMint(_to, _amount, "");
    }

    function _safeMint(
        address _to,
        uint256 _amount,
        bytes memory _data
    ) internal virtual {
        if (!_checkOnERC721Received(address(0), _to, _owners.length - 1, _data)) {
            revert ERC721C__NonErc721RReceiver();
        }
        _mint(_to, _amount);
    }

    function _mint(address _to, uint256 _amount) internal virtual {
        if (_amount == 0) {
            revert ERC721C__InvalidMintAmount();
        }

        uint256 _currentIndex = _owners.length;

        // Cannot realistically overflow, since we are using uint256
        unchecked {
            for (uint256 i; i < _amount - 1; i++) {
                _owners.push();
                emit Transfer(address(0), _to, _currentIndex + i);
            }
        }

        // set last index to receiver
        _owners.push(_to);
        emit Transfer(address(0), _to, _currentIndex + (_amount - 1));
    }

    function _burn(uint256 _tokenId) internal virtual tokenExists(_tokenId) {
        address _owner = ownerOf(_tokenId);
        _owners[_tokenId] = address(1);
        delete _tokenApprovals[_tokenId];

        if (_tokenId > 0 && _owners[_tokenId - 1] == address(0)) {
            _owners[_tokenId - 1] = _owner;
        }

        emit Transfer(_owner, address(1), _tokenId);
    }

    function _getBurntCount() internal view virtual returns (uint256 burnCount) {
        uint256 supply = _owners.length;
        for (uint256 i; i < supply; i++) {
            if (_owners[i] == address(1)) {
                burnCount += 1;
            }
        }
    }

    function _getBurntCountBeforeIndex(uint256 _index)
        internal
        view
        virtual
        returns (uint256 burnCount)
    {
        uint256 supply = _owners.length;
        if (_index >= supply) {
            revert ERC721C__IndexOverflow();
        }
        for (uint256 i; i <= _index; i++) {
            if (_owners[i] == address(1)) {
                burnCount += 1;
            }
        }
    }
}
