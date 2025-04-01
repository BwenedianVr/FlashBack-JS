document.getElementById('swfInput').addEventListener('change', function(event) {
    let file = event.target.files[0];
    if (file) {
        let reader = new FileReader();
        reader.onload = function(e) {
            let swfData = e.target.result;
            processSWF(swfData);
        };
        reader.readAsArrayBuffer(file);
    }
});

function processSWF(swfData) {
    console.log("Processing SWF file...");
    let reader = new DataView(swfData);
    let offset = 0;
    while (offset < reader.byteLength) {
        let tag = reader.getUint16(offset, true);
        let tagLength = reader.getUint32(offset + 2, true);
        offset += 6;
        let tagData = reader.buffer.slice(offset, offset + tagLength);
        offset += tagLength;

        let functionName = getFunctionName(tag);
        if (functionName && typeof window[functionName] !== 'function') {
            alert("Function " + functionName + " is not defined!");
        }
    }
}

function getFunctionName(tag) {
    switch (tag) {
        case 0x01: return 'start';
        case 0x02: return 'stop';
        default: return null;
    }
}
