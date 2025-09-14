class Controls {
    constructor(type) {
        this.forward = false;
        this.left = false;
        this.right = false;
        this.reverse = false;

        switch(type){
            case "PLAYER":
                this.#addKeyboardListeners();
                break;
            case "DUMMY":
                this.forward = true;
                break;
        }
    }

    #addKeyboardListeners() {
        document.onkeydown = (event) => {
            // NEW: Check if we are in driving mode before preventing default
            if (mode === "DRIVING") {
                // Prevent arrow keys from scrolling the page
                if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
                    event.preventDefault();
                }
            }

            switch (event.key) {
                case "ArrowLeft": this.left = true; break;
                case "ArrowRight": this.right = true; break;
                case "ArrowUp": this.forward = true; break;
                case "ArrowDown": this.reverse = true; break;
            }
        };
        document.onkeyup = (event) => {
            switch (event.key) {
                case "ArrowLeft": this.left = false; break;
                case "ArrowRight": this.right = false; break;
                case "ArrowUp": this.forward = false; break;
                case "ArrowDown": this.reverse = false; break;
            }
        };
    }
}