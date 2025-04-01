// Import the pako library for decompression
import * as pako from 'pako';

class SWFParser {
  constructor(swfData) {
    this.data = swfData; // SWF file as an ArrayBuffer
    this.pointer = 0;
    this.header = null;
    this.tags = [];
    this.sounds = []; // To store extracted sound data
    this.images = []; // Store extracted images
  }
  function parseActionScript(swfData) {
    let actions = [];
    let abcData = [];
    let offset = 0;

    while (offset < swfData.length) {
        let tagCodeAndLength = swfData.readUint16(offset);
        let tagCode = tagCodeAndLength >> 6;
        let tagLength = tagCodeAndLength & 0x3F;

        if (tagLength === 0x3F) {
            tagLength = swfData.readUint32(offset + 2);
            offset += 6;
        } else {
            offset += 2;
        }

        let tagData = swfData.slice(offset, offset + tagLength);

        if (tagCode === 12) { // DoAction (AS2)
            let actionBytes = parseAS2(tagData);
            actions.push(actionBytes);
        } else if (tagCode === 82) { // DoABC (AS3)
            let abcScript = parseAS3(tagData);
            abcData.push(abcScript);
        }

        offset += tagLength;
    }

    sendToVM(actions, abcData);
}

function parseAS2(data) {
    let result = [];
    let offset = 0;

    while (offset < data.length) {
        let opcode = data[offset];
        offset++;

        switch (opcode) {
            case 0x81: // GotoFrame
                result.push(`GotoFrame ${data.readUint16(offset)}`);
                offset += 2;
                break;
            case 0x83: // GetURL
                let url = readString(data, offset);
                offset += url.length + 1;
                let target = readString(data, offset);
                offset += target.length + 1;
                result.push(`GetURL("${url}", "${target}")`);
                break;
            case 0x8F: // Wait
                result.push(`Wait ${data.readUint16(offset)} ms`);
                offset += 2;
                break;
            case 0xA0: // SetVariable
                let variable = readString(data, offset);
                offset += variable.length + 1;
                let value = readValue(data, offset);
                offset += value.length;
                result.push(`SetVariable("${variable}", ${value})`);
                break;
            case 0x9B: // Push
                result.push(`Push ${readValue(data, offset)}`);
                offset += 2;
                break;
            case 0x96: // Pop
                result.push("Pop");
                break;
            default:
                result.push(`[Unknown AS2 Opcode: 0x${opcode.toString(16)}]`);
                break;
        }
    }

    return result;
}

function parseAS3(data) {
    let decoder = new ABCDecoder(data);
    return decoder.decode(); // Full decoding of AS3 bytecode
}

function sendToVM(as2, as3) {
    if (as2.length > 0) {
        console.log("Executing AS2:", as2);
        AS3VM.executeAS2(as2);
    }
    if (as3.length > 0) {
        console.log("Executing AS3:", as3);
        AS3VM.executeAS3(as3);
    }
}

function readString(data, offset) {
    let str = "";
    while (data[offset] !== 0) {
        str += String.fromCharCode(data[offset]);
        offset++;
    }
    return str;
}

function readValue(data, offset) {
    let type = data[offset];
    offset++;
    switch (type) {
        case 0x00: // Integer
            return data.readInt16(offset);
        case 0x01: // String
            return `"${readString(data, offset)}"`;
        case 0x02: // Float
            return data.readFloat32(offset);
        case 0x03: // Boolean
            return data[offset] === 0 ? "false" : "true";
        default:
            return `[Unknown Type: 0x${type.toString(16)}]`;
    }
}

// Enhanced ABCDecoder for Full AS3 Decoding
class ABCDecoder {
    constructor(data) {
        this.data = data;
        this.offset = 0;
        this.constants = [];
        this.methods = [];
        this.classes = [];
        this.traits = [];
        this.namespaces = [];
    }

    decode() {
        let magic = this.readUint32();
        if (magic !== 0x58584243) {  // ABC Magic number
            throw new Error("Invalid ABC file: Invalid magic number");
        }

        let minorVersion = this.readUint16();
        let majorVersion = this.readUint16();
        let constantPoolCount = this.readUint32();
        this.constants = this.decodeConstants(constantPoolCount);

        let methodCount = this.readUint32();
        this.methods = this.decodeMethods(methodCount);

        let classCount = this.readUint32();
        this.classes = this.decodeClasses(classCount);

        return {
            constants: this.constants,
            methods: this.methods,
            classes: this.classes,
            namespaces: this.namespaces,
        };
    }

    decodeConstants(count) {
        let constants = [];
        for (let i = 0; i < count; i++) {
            constants.push(this.readConstant());
        }
        return constants;
    }

    decodeMethods(count) {
        let methods = [];
        for (let i = 0; i < count; i++) {
            methods.push(this.readMethod());
        }
        return methods;
    }

    decodeClasses(count) {
        let classes = [];
        for (let i = 0; i < count; i++) {
            classes.push(this.readClass());
        }
        return classes;
    }

    readUint32() {
        this.checkEOF(4);
        let value = this.data.readUint32(this.offset);
        this.offset += 4;
        return value;
    }

    readUint16() {
        this.checkEOF(2);
        let value = this.data.readUint16(this.offset);
        this.offset += 2;
        return value;
    }

    readUint8() {
        this.checkEOF(1);
        let value = this.data.readUint8(this.offset);
        this.offset += 1;
        return value;
    }

    readConstant() {
        let type = this.readUint8();
        switch (type) {
            case 0x01: // String
                return this.readString();
            case 0x02: // Integer
                return this.readInt();
            case 0x03: // Float
                return this.readFloat();
            case 0x04: // Double
                return this.readDouble();
            case 0x05: // Boolean
                return this.readBoolean();
            case 0x06: // Null
                return null;
            case 0x07: // Undefined
                return undefined;
            default:
                throw new Error(`Unknown constant type: 0x${type.toString(16)}`);
        }
    }

    readString() {
        let length = this.readUint16();
        let value = this.data.toString('utf8', this.offset, this.offset + length);
        this.offset += length;
        return value;
    }

    readInt() {
        return this.readUint32();
    }

    readFloat() {
        this.checkEOF(4);
        let value = this.data.readFloat32(this.offset);
        this.offset += 4;
        return value;
    }

    readDouble() {
        this.checkEOF(8);
        let value = this.data.readDouble(this.offset);
        this.offset += 8;
        return value;
    }

    readBoolean() {
        return this.readUint8() === 1;
    }

    readMethod() {
        let length = this.readUint32();
        return this.data.slice(this.offset, this.offset + length);
    }

    readClass() {
        let className = this.readString();
        let superClassName = this.readString();
        let traitCount = this.readUint32();
        let traits = [];
        for (let i = 0; i < traitCount; i++) {
            traits.push(this.readTrait());
        }
        return {
            className,
            superClassName,
            traits
        };
    }

    readTrait() {
        let traitType = this.readUint8();
        let name = this.readString();
        let attributes = this.readUint8(); // Trait attributes (e.g., final, override, etc.)
        return {
            traitType,
            name,
            attributes
        };
    }

    checkEOF(length) {
        if (this.offset + length > this.data.length) {
            throw new Error("Unexpected end of file (EOF) during ABC decoding");
        }
    }
}

function handleError(error) {
    console.error("Parsing Error: ", error.message);
    alert(`Error: ${error.message}`);
}


  // Read a specific number of bytes from the SWF file (ArrayBuffer)
  readBytes(length) {
    const bytes = new Uint8Array(this.data, this.pointer, length);
    this.pointer += length;
    return bytes;
  }

  // Read a 32-bit integer (Big Endian)
  readUInt32() {
    const bytes = this.readBytes(4);
    return (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  }

  // Read a 16-bit integer (Big Endian)
  readUInt16() {
    const bytes = this.readBytes(2);
    return (bytes[0] << 8) | bytes[1];
  }

  // Read a string until the null byte (C-string)
  readString() {
    let result = '';
    let byte;
    while ((byte = this.readBytes(1)[0]) !== 0) {
      result += String.fromCharCode(byte);
    }
    return result;
  }

  // Decompress a CWS (compressed SWF) file using pako
  decompress() {
    const compressedData = new Uint8Array(this.data, 8); // Remove header (first 8 bytes)
    const decompressedData = pako.inflate(compressedData);
    this.data = decompressedData.buffer; // Replace the original data with the decompressed one
    this.pointer = 0; // Reset pointer to the start of the decompressed data
  }

  // Parse the SWF header
  parseHeader() {
    const signature = this.readString();  // "FWS" or "CWS"
    const version = this.readUInt8();
    const fileLength = this.readUInt32();

    this.header = {
      signature,
      version,
      fileLength
    };

    // If it's a compressed SWF file, decompress it
    if (signature === 'CWS') {
      console.log('SWF file is compressed. Decompressing...');
      this.decompress();
    }
  }

  // Parse SWF tags
  parseTags() {
    let tag = null;

    while (this.pointer < this.data.byteLength) {
      const tagHeader = this.readUInt16();
      const tagType = tagHeader >> 6;
      let tagLength = tagHeader & 0x3F;

      if (tagLength === 0x3F) {
        tagLength = this.readUInt32();
      }

      // Handle different tag types
      switch (tagType) {
        case 0x01: // DefineShape
          tag = this.readBytes(tagLength);
          break;
        case 0x04: // AudioStream (SoundStreamHead)
          tag = this.readBytes(tagLength);
          break;
        case 0x14: // DefineSound
          this.extractSound(tagLength);
          break;
        // Add more cases as needed for other tag types
        default:
          tag = this.readBytes(tagLength);
          break;
        case 0x06: // DefineBits
        case 0x21: // DefineBitsJPEG2
        case 0x35: // DefineBitsJPEG3
          this.extractImage(tagType, tagLength);
          break;

      }

      this.tags.push({
        tagType,
        data: tag
      });
    }
  }

  // Extract sound data from DefineSound tag
  extractSound(tagLength) {
    const soundData = this.readBytes(tagLength);
    this.sounds.push(soundData); // Store the sound data
    console.log('Extracted sound data:', soundData);
  }
  extractImage(tagType, tagLength) {
    const imageData = this.readBytes(tagLength);
    this.images.push({ tagType, data: imageData });
    console.log('Extracted image:', imageData);
}
  function createImageFromData(imageData) {
    const blob = new Blob([imageData], { type: 'image/jpeg' }); // Adjust based on format
    return URL.createObjectURL(blob);
}



  // Parse the entire SWF file
  parse() {
    this.parseHeader();
    this.parseTags();
  }

  // Print parsed information
  print() {
    console.log('SWF Header:', this.header);
    console.log('SWF Tags:', this.tags);
    console.log('Extracted Sounds:', this.sounds);
  }
}

class AS3VM {
  constructor() {
    this.stack = []; // Stack for holding values
    this.variables = {}; // Variables to store global values
    this.pc = 0; // Program counter, keeps track of bytecode execution
    this.running = false; // Flag to track VM execution state
    this.sounds = {}; // Store sounds
    this.images = {}; // Store images
    this.videos = {}; // Store videos
  }
  loadFromSWF(swfParser) {
        this.autoImplementImages(swfParser.images);
        this.autoImplementSounds(swfParser.sounds);
        this.autoImplementScripts(swfParser.scripts);
    }

    autoImplementImages(images) {
        images.forEach((imageData, index) => {
            const imgBlob = new Blob([imageData], { type: 'image/jpeg' }); 
            const imgUrl = URL.createObjectURL(imgBlob);
            this.images[`image_${index}`] = imgUrl;
            console.log(`Loaded image_${index}`);
        });
    }

    autoImplementSounds(sounds) {
        sounds.forEach((soundData, index) => {
            const soundBlob = new Blob([soundData], { type: 'audio/mpeg' }); 
            const soundUrl = URL.createObjectURL(soundBlob);
            this.sounds[`sound_${index}`] = soundUrl;
            console.log(`Loaded sound_${index}`);
        });
    }

    autoImplementScripts(scripts) {
        scripts.forEach((script, index) => {
            this.scripts.push(this.executeScript(script));
            console.log(`Executed script_${index}`);
        });
    }

    executeScript(script) {
        return `// Fake execution: ${script.length} bytes of AS3 code`;
    }

  // Main method to execute ActionScript bytecode
  execute(bytecode) {
    this.running = true;
    this.bytecode = bytecode; // Load the bytecode
    while (this.running && this.pc < this.bytecode.length) {
      const opCode = this.bytecode[this.pc++];
      this.executeOpcode(opCode, bytecode);
    }
  }

  // Execute each opcode based on its value
  executeOpcode(opCode, bytecode) {
    switch (opCode) {
      case 0x01:  // Push literal (e.g., numbers or strings)
        this.pushLiteral(bytecode);
        break;
      case 0x02:  // Add
        this.add();
        break;
      case 0x03:  // Subtract
        this.subtract();
        break;
      case 0x04:  // Multiply
        this.multiply();
        break;
      case 0x05:  // Divide
        this.divide();
        break;
      case 0x06:  // Jump (conditional and unconditional)
        this.jump(bytecode);
        break;
      case 0x07:  // If/Else (conditional jump)
        this.ifElse(bytecode);
        break;
      case 0x08:  // Call function
        this.callFunction(bytecode);
        break;
      case 0x09:  // Return from function
        this.returnFromFunction();
        break;
      case 0x0A:  // Store value in a variable
        this.storeVariable(bytecode);
        break;
      case 0x0B:  // Load value from a variable
        this.loadVariable(bytecode);
        break;
      case 0x0C:  // Load sound (SWF Multimedia)
        this.loadSound(bytecode);
        break;
      case 0x0D:  // Play sound (SWF Multimedia)
        this.playSound(bytecode);
        break;
      case 0x0E:  // Load image (SWF Multimedia)
        this.loadImage(bytecode);
        break;
      case 0x0F:  // Display image (SWF Multimedia)
        this.displayImage(bytecode);
        break;
      case 0x10:  // Load video (SWF Multimedia)
        this.loadVideo(bytecode);
        break;
      case 0x11:  // Play video (SWF Multimedia)
        this.playVideo(bytecode);
        break;

      // Additional Opcodes
      case 0x12:  // Duplicate
        this.duplicate();
        break;
      case 0x13:  // Swap
        this.swap();
        break;
      case 0x14:  // Modulo
        this.mod();
        break;
      case 0x15:  // String Concatenate
        this.stringConcat();
        break;
      case 0x16:  // String Length
        this.stringLength();
        break;
      case 0x17:  // Equals
        this.equals();
        break;
      case 0x18:  // Not Equals
        this.notEquals();
        break;
      case 0x19:  // Less Than
        this.lessThan();
        break;
      case 0x1A:  // Greater Than
        this.greaterThan();
        break;
      case 0x1B:  // Logical AND
        this.and();
        break;
      case 0x1C:  // Logical OR
        this.or();
        break;
      case 0x1D:  // Logical NOT
        this.not();
        break;
      case 0x1E:  // Create New Object
        this.newObject();
        break;
      case 0x1F:  // Delete Object Property
        this.deleteObjectProperty();
        break;
      case 0x20:  // Trace (debugging output)
        this.trace();
        break;

      default:
        console.log("Unknown Opcode:", opCode);
        break;
    }
  }

  // Push literal data (e.g., numbers, strings, etc.) onto the stack
  pushLiteral(bytecode) {
    const value = bytecode[this.pc++];
    this.stack.push(value);
  }

  // Add two values on the stack
  add() {
    const b = this.stack.pop();
    const a = this.stack.pop();
    this.stack.push(a + b);
  }

  // Subtract two values on the stack
  subtract() {
    const b = this.stack.pop();
    const a = this.stack.pop();
    this.stack.push(a - b);
  }

  // Multiply two values on the stack
  multiply() {
    const b = this.stack.pop();
    const a = this.stack.pop();
    this.stack.push(a * b);
  }

  // Divide two values on the stack
  divide() {
    const b = this.stack.pop();
    const a = this.stack.pop();
    if (b === 0) {
      this.stack.push(0); // Handle divide by zero (NaN case)
    } else {
      this.stack.push(a / b);
    }
  }

  // Duplicate the top item on the stack
  duplicate() {
    const value = this.stack[this.stack.length - 1];
    this.stack.push(value);
  }

  // Swap the top two items on the stack
  swap() {
    const b = this.stack.pop();
    const a = this.stack.pop();
    this.stack.push(b);
    this.stack.push(a);
  }

  // Modulo operation (top two stack values)
  mod() {
    const b = this.stack.pop();
    const a = this.stack.pop();
    this.stack.push(a % b);
  }

  // Concatenate two strings from the stack
  stringConcat() {
    const b = this.stack.pop();
    const a = this.stack.pop();
    this.stack.push(a + b);
  }

  // Push the length of the string from the top of the stack
  stringLength() {
    const str = this.stack.pop();
    this.stack.push(str.length);
  }

  // Check if the top two items are equal
  equals() {
    const b = this.stack.pop();
    const a = this.stack.pop();
    this.stack.push(a === b);
  }

  // Check if the top two items are not equal
  notEquals() {
    const b = this.stack.pop();
    const a = this.stack.pop();
    this.stack.push(a !== b);
  }

  // Check if the second item is less than the top item
  lessThan() {
    const b = this.stack.pop();
    const a = this.stack.pop();
    this.stack.push(a < b);
  }

  // Check if the second item is greater than the top item
  greaterThan() {
    const b = this.stack.pop();
    const a = this.stack.pop();
    this.stack.push(a > b);
  }

  // Logical AND on the top two stack values
  and() {
    const b = this.stack.pop();
    const a = this.stack.pop();
    this.stack.push(a && b);
  }

  // Logical OR on the top two stack values
  or() {
    const b = this.stack.pop();
    const a = this.stack.pop();
    this.stack.push(a || b);
  }

  // Logical NOT on the top item
  not() {
    const value = this.stack.pop();
    this.stack.push(!value);
  }

  // Create a new object and push it onto the stack
  newObject() {
    const obj = {};
    this.stack.push(obj);
  }

  // Delete a property from an object on the stack
  deleteObjectProperty() {
    const propertyName = this.stack.pop();
    const obj = this.stack.pop();
    delete obj[propertyName];
  }

  // Trace the top value (debugging)
  trace() {
    const value = this.stack.pop();
    console.log("Trace:", value);
  }

  // Load sound from bytecode (SWF Multimedia)
  loadSound(bytecode) {
    const soundID = bytecode[this.pc++];
    const soundData = bytecode[this.pc++];
    this.sounds[soundID] = soundData;
    console.log("Sound loaded:", soundID);
  }

  // Play sound from stored sound data (SWF Multimedia)
  playSound(bytecode) {
    const soundID = bytecode[this.pc++];
    const sound = this.sounds[soundID];
    if (sound) {
      console.log("Playing sound:", soundID);
      // Implement actual audio playback
    }
  }

  // Load image from bytecode (SWF Multimedia)
  loadImage(bytecode) {
    const imageID = bytecode[this.pc++];
    const imageData = bytecode[this.pc++];
    this.images[imageID] = imageData;
    console.log("Image loaded:", imageID);
  }

  // Display image from stored image data (SWF Multimedia)
  displayImage(bytecode) {
    const imageID = bytecode[this.pc++];
    const image = this.images[imageID];
    if (image) {
      console.log("Displaying image:", imageID);
      // Implement actual image display
    }
  }

  // Load video from bytecode (SWF Multimedia)
  loadVideo(bytecode) {
    const videoID = bytecode[this.pc++];
    const videoData = bytecode[this.pc++];
    this.videos[videoID] = videoData;
    console.log("Video loaded:", videoID);
  }
  class AS3VM {
  constructor() {
    this.stack = [];
  }

  execute(bytecode) {
    while (this.pc < bytecode.length) {
      const op = bytecode[this.pc++];
      switch (op) {
        case 0x30: // Create a Timer
          this.createTimer(bytecode);
          break;
        case 0x31: // Create an XML
          this.createXML(bytecode);
          break;
        case 0x32: // Create FileReference
          this.createFileReference(bytecode);
          break;
        // Add more opcodes as needed...
      }
    }
  }

  // Opcode 0x30: Create Timer
  createTimer(bytecode) {
    const delay = bytecode[this.pc++];
    const repeatCount = bytecode[this.pc++];
    const timer = new Timer(delay, repeatCount);
    this.stack.push(timer);
  }
    // Execute a 'for' loop
  executeForLoop(bytecode) {
    const start = this.stack.pop();  // Initial value
    const condition = this.stack.pop();  // End condition
    const increment = this.stack.pop();  // Step increment
    const loopStart = this.pc;  // Loop start position

    for (let i = start; i < condition; i += increment) {
      this.pc = loopStart;
      this.execute(bytecode); // Re-execute bytecode inside loop
    }
  }

  // Execute a 'while' loop
  executeWhileLoop(bytecode) {
    const loopStart = this.pc; // Store loop start

    while (this.stack.pop()) { // Condition check
      this.pc = loopStart;
      this.execute(bytecode); // Execute loop body
    }
  }
    extractText(tagLength) {
    const textData = this.readBytes(tagLength);
    const decodedText = new TextDecoder("utf-8").decode(textData);
    console.log('Extracted Text:', decodedText);
  }



  // Opcode 0x31: Create XML
  createXML(bytecode) {
    const xmlString = bytecode[this.pc++];
    const xml = new XML(xmlString);
    this.stack.push(xml);
  }

  // Opcode 0x32: Create FileReference
  createFileReference(bytecode) {
    const fileRef = new FileReference();
    this.stack.push(fileRef);
  }
}


  // Play video from stored video data (SWF Multimedia)
  playVideo(bytecode) {
    const videoID = bytecode[this.pc++];
    const video = this.videos[videoID];
    if (video) {
      console.log("Playing video:", videoID);
      // Implement actual video playback
    }
  }
}

// Test Example: Execute some bytecode
const bytecode = [
  0x01, 10, // Push 10
  0x01, 5,  // Push 5
  0x02,      // Add (10 + 5)
  0x12,      // Duplicate top of stack
  0x13,      // Swap top two stack values
  0x14,      // Modulo operation (10 % 5)
  0x15,      // String Concatenate operation (concatenate "Hello" + " World")
  0x16,      // String length (length of "Hello World")
  0x17       // Equals (compare if 10 == 5)
];

const vm = new AS3VM();
vm.execute(bytecode);
