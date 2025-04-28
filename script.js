"use strict";

const elements = {
    uploadedWrapper: document.getElementById("file-uploaded"),
    convertedWrapper: document.getElementById("file-converted"),
    pendingWrapper: document.getElementById("file-upload-pending"),
    fileName: document.getElementById("file-name"),
    fileRemove: document.getElementById("file-remove"),
    fileLabel: document.getElementById("file-input-label"),
    fileInput: document.getElementById("file-input"),
    fileSubmit: document.getElementById("file-submit"),
    svgCode: document.getElementById("svg-code"),
    svgSave: document.getElementById("svg-save"),
    svgDelete: document.getElementById("svg-delete"),
};

let filePreview;
let fileNameElement;
let fileNameText;
let svgContent;

const supportedFormats = [
    { extension: "image/jpeg", description: "JPG" },
    { extension: "image/jpeg", description: "JPEG" },
    { extension: "image/png", description: "PNG" },
    { extension: "image/gif", description: "GIF" },
    { extension: "image/bmp", description: "BMP" },
    { extension: "image/webp", description: "WEBP" },
];

// Create an array of unique MIME types for file input "accept" attribute
const uniqueExtensions = [];
supportedFormats.forEach((format) => {
    if (!uniqueExtensions.includes(format.extension)) {
        uniqueExtensions.push(format.extension);
    }
});

elements.fileInput.setAttribute("accept", uniqueExtensions.join(", "));

let supportedText = "";
for (const format of supportedFormats) {
    supportedText += format.description + ", ";
}
supportedText = supportedText.slice(0, -2);

const fileInfo = document.createElement("p");
fileInfo.className = "form__info";
fileInfo.textContent = `Supported formats: ${supportedText}`;
elements.pendingWrapper.append(fileInfo);

// Shorten long file names by inserting "..." in the middle
function shortenFileName(name, maxLength = 32) {
    if (!name || name.length <= maxLength) {
        return document.createTextNode(name || "");
    }

    const halfLength = Math.floor((maxLength - 1) / 2);

    const template = document.createElement("template");

    template.innerHTML =
        name.slice(0, halfLength) +
        '<span class="form__file-name-dots">...</span>' +
        name.slice(-halfLength);

    return template.content;
}

function resetFileState() {
    filePreview?.remove();
    fileNameElement?.remove();
    filePreview = fileNameElement = null;
    elements.fileInput.value = "";
}

// Convert image file to SVG by mapping non-transparent pixels
function imageToSVG(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );
                const data = imageData.data;
                const width = canvas.width;
                const height = canvas.height;

                const svgGenerator = new SVGGenerator(width, height);

                // Iterate through every pixel and add visible ones to SVG
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const idx = (y * width + x) * 4;
                        const [r, g, b, a] = data.slice(idx, idx + 4);

                        if (a !== 0) {
                            // Only if pixel is not fully transparent
                            svgGenerator.addColorRect(x, y, r, g, b, a);
                        }
                    }
                }

                const svgContent = svgGenerator.generateSVG();
                resolve(svgContent);
            };

            img.src = e.target.result;
        };

        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Helper class to generate SVG paths based on pixel colors
class SVGGenerator {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.colorPaths = {}; // Group rectangles by color
    }

    // Add a colored rectangle for a pixel, merging horizontally adjacent ones
    addColorRect(x, y, r, g, b, a) {
        const color = this.getColor(r, g, b, a);

        if (!this.colorPaths[color]) {
            this.colorPaths[color] = [];
        }

        let last = this.colorPaths[color].length
            ? this.colorPaths[color][this.colorPaths[color].length - 1]
            : null;

        // Merge consecutive horizontal pixels of the same color into one rect
        if (
            last &&
            last.x + last.width === x &&
            last.y === y &&
            last.height === 1
        ) {
            last.width += 1;
        } else {
            this.colorPaths[color].push({ x, y, width: 1, height: 1 });
        }
    }

    // Format color to RGBA string
    getColor(r, g, b, a) {
        return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${(
            a / 255
        ).toFixed(2)})`;
    }

    // Build the final SVG string
    generateSVG() {
        const svgParts = [
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.width} ${this.height}">`,
        ];

        for (const [color, rects] of Object.entries(this.colorPaths)) {
            let pathData = "";
            rects.forEach(({ x, y, width, height }) => {
                pathData += `M${x},${y}h${width}v${height}h-${width}z`;
            });
            svgParts.push(`<path fill="${color}" d="${pathData}" />`);
        }

        svgParts.push("</svg>");
        return svgParts.join("");
    }
}

elements.fileRemove.addEventListener("click", (event) => {
    event.preventDefault();
    resetFileState();
    elements.uploadedWrapper.hidden = true;
    elements.pendingWrapper.hidden = false;
});

elements.fileLabel.addEventListener("dragover", (event) => {
    event.preventDefault();
    elements.fileLabel.classList.add("form__label_dragover");
});

elements.fileLabel.addEventListener("dragleave", (event) => {
    event.preventDefault();
    elements.fileLabel.classList.remove("form__label_dragover");
});

// Handle file drop and simulate file input "change"
elements.fileLabel.addEventListener("drop", (event) => {
    event.preventDefault();
    elements.fileLabel.classList.remove("form__label_dragover");

    const file = event.dataTransfer.files[0];
    if (file) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        elements.fileInput.files = dataTransfer.files;

        elements.fileInput.dispatchEvent(new Event("change"));
    }
});

elements.fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
        const validFormat = supportedFormats.find(
            (format) => format.extension === file.type
        );

        if (validFormat) {
            const reader = new FileReader();

            reader.onload = (e) => {
                filePreview = document.createElement("img");
                filePreview.src = e.target.result;
                filePreview.alt = "Image preview";
                filePreview.className = "form__preview-img";
                elements.uploadedWrapper.prepend(filePreview);

                fileNameText = file.name;
                fileNameElement = document.createElement("span");
                fileNameElement.className = "file__name-text";
                fileNameElement.append(shortenFileName(fileNameText));
                elements.fileName.prepend(fileNameElement);

                elements.uploadedWrapper.hidden = false;
                elements.pendingWrapper.hidden = true;
            };

            reader.readAsDataURL(file);
        } else {
            const fileError = document.createElement("p");
            fileError.className = "form__error";
            fileError.textContent = `Unsupported format! Please upload a ${supportedText} image.`;
            elements.pendingWrapper.append(fileError);
            fileInfo.hidden = true;
            elements.fileInput.addEventListener("click", (event) => {
                fileInfo.hidden = false;
                fileError?.remove();
            });
        }
    }
});

elements.fileSubmit.addEventListener("click", (event) => {
    event.preventDefault();
    const file = elements.fileInput.files[0];

    if (file) {
        imageToSVG(file)
            .then((result) => {
                svgContent = result;

                const codeTag = document.createElement("code");
                codeTag.textContent = svgContent;
                elements.svgCode.append(codeTag);

                elements.convertedWrapper.hidden = false;
                elements.uploadedWrapper.hidden = true;
                resetFileState();
            })
            .catch((error) => {
                const fileError = document.createElement("p");
                fileError.className = "form__error";
                fileError.textContent = `Error converting image to SVG: ${error}`;
                elements.uploadedWrapper.append(fileError);
            });
    }
});

// Select all SVG code when Ctrl+A is pressed inside or over the code block
function selectContent(el) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);
}

document.addEventListener("keydown", (e) => {
    const isFocusedOrHovered =
        elements.svgCode === document.activeElement ||
        elements.svgCode.matches(":hover");

    if (e.ctrlKey && e.key === "a" && isFocusedOrHovered) {
        e.preventDefault();
        selectContent(elements.svgCode);
    }
});

// Save generated SVG as a downloadable file
elements.svgSave.addEventListener("click", (event) => {
    event.preventDefault();

    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;

    let name = "image.svg";
    if (fileNameText) {
        name = fileNameText.replace(/\.[^/.]+$/, ".svg");
    }
    fileNameText = null;

    link.download = name;
    link.addEventListener("click", () => {
        setTimeout(() => URL.revokeObjectURL(url), 0); // Clean up URL after download
    });
    link.click();
});

elements.svgDelete.addEventListener("click", (event) => {
    event.preventDefault();

    elements.convertedWrapper.hidden = true;
    elements.pendingWrapper.hidden = false;

    elements.svgCode.textContent = "";
    svgContent = null;
    fileNameText = null;
});
