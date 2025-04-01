// Import the pako library for decompression (install via npm or link the CDN in the HTML)
import * as pako from 'pako';

class SWFParser {
  constructor(swfData) {
    this.data = swfData; // SWF file as an ArrayBuffer
    this.pointer = 0;
    this.header = null;
    this.tags = [];
    this.sounds = []; // To store extracted sound data
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
