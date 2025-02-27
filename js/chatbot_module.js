export class Chatbot {
	constructor(config = {}) {
		// Default configuration
		this.config = {
			MERCHANT_NAME: "My Chatbot",
			MERCHANT_LOGO: "",
			SHOW_ONLINE_STATUS: true,
			API_URL: "https://example.com/chat",
			INITIAL_MESSAGE: "Hi there 👋<br>How can I help you today?",
			THINKING_MESSAGE: "",
			ERROR_MESSAGE: "Oops! Something went wrong. Please try again.",
			INPUT_PLACEHOLDER: "Enter a message...",
			LOADING_DELAY: 600, // Delay before showing "Thinking..." message

			PRIMARY_BG_COLOR: "#b31a69", // Primary background color for UI elements
			PRIMARY_TEXT_COLOR: "#fff", // Primary text color for UI elements
			CHATBOX_BG_COLOR: "#ccc", // Background color for chatbox
			INCOMING_CHAT_BG_COLOR: "#f2f2f2", // Background color for incoming chat
			INCOMING_CHAT_TEXT_COLOR: "#000", // Text color for incoming chat
			ERROR_CHAT_BG_COLOR: "#f8d7da", // Background color for chat error
			ERROR_CHAT_TEXT_COLOR: "#721c24", // Text color for chat error

			TIMEOUT: 5000, // API timeout in milliseconds
			MAX_MESSAGES_PER_MINUTE: 10, // Maximum messages allowed per minute
			RATE_LIMIT_ERROR_MESSAGE: "You've sent too many messages. Please wait a minute and try again.",
			...config, // Override defaults with provided config
		};

		// State
		this.userMessage = "";
		this.isLoading = false;
		this.inputInitHeight = 0;

		// Rate limiting state
		this.messageCount = 0; // Track the number of messages sent
		this.rateLimitStartTime = null; // Track when the counting started

		// Initialize the chatbot UI
		this.initChatbotUI();
		this.setupEventListeners();
	}

	// Initialize the chatbot UI
	initChatbotUI() {
		this.chatbotContainer = document.createElement('div');
		this.chatbotContainer.classList.add('chatbot-container');
		// this.chatbotContainer.classList.add('show-chatbot'); // Show chatbot by default
		this.chatbotContainer.style.setProperty("--primary-text-color", this.config.PRIMARY_TEXT_COLOR);
		this.chatbotContainer.style.setProperty("--primary-bg-color", this.config.PRIMARY_BG_COLOR);
		this.chatbotContainer.style.setProperty("--chatbox-bg-color", this.config.CHATBOX_BG_COLOR);
		this.chatbotContainer.style.setProperty("--incoming-chat-bg-color", this.config.INCOMING_CHAT_BG_COLOR);
		this.chatbotContainer.style.setProperty("--incoming-chat-text-color", this.config.INCOMING_CHAT_TEXT_COLOR);
		this.chatbotContainer.style.setProperty("--error-chat-text-color", this.config.ERROR_CHAT_TEXT_COLOR);
		this.chatbotContainer.style.setProperty("--error-chat-bg-color", this.config.ERROR_CHAT_BG_COLOR);
		this.chatbotContainer.innerHTML = `
			<button class="chatbot-toggler" aria-label="Toggle chatbot">
				<span class="material-symbols-outlined">mode_comment</span>
				<span class="material-symbols-outlined">close</span>
			</button>
			<div class="chatbot">
				<header>
					<div class="chatbot-info">
						${this.config.MERCHANT_LOGO ? `<img src="${this.config.MERCHANT_LOGO}" class="merchant-logo"/>` : '<span class="material-symbols-outlined">smart_toy</span>'}
						<div>
							<h2 style="line-height: ${this.config.SHOW_ONLINE_STATUS ? '24' : '42'}px;">${this.config.MERCHANT_NAME}</h2>
							<p class="network-status" style="display: ${this.config.SHOW_ONLINE_STATUS ? 'block' : 'none'};"}"><span></span>Online</p>
						</div>
					</div>
					<span class="close-btn material-symbols-outlined" aria-label="Close chatbot">close</span>
				</header>
				<ul class="chatbox">
					<li class="chat incoming">
						${this.config.MERCHANT_LOGO ? `<img src="${this.config.MERCHANT_LOGO}" class="merchant-logo"/>` : '<span class="material-symbols-outlined">smart_toy</span>'}
						<p>${this.config.INITIAL_MESSAGE}</p>
					</li>
				</ul>
				<div class="chat-input">
					<textarea placeholder="${this.config.INPUT_PLACEHOLDER}" required aria-label="Chat input"></textarea>
					<span id="send-btn" class="material-symbols-outlined" aria-label="Send message">send</span>
				</div>
				<div class="chatbot-footer">
					<div>
						Powered by:
						<a href="https://ailiien.com" target="_blank">
							<img src="https://firebasestorage.googleapis.com/v0/b/file-uploader-59dfb.appspot.com/o/uploads%2Fcdn%2Fchatbot%2Fimages%2Flogo_no_bg.png?alt=media&token=8cafce86-6ab5-4235-8239-e5351cfe37cc" />
							<p>AILIIEN</p>
						</a>
					</div>
				</div>
			</div>
		`;

		document.body.appendChild(this.chatbotContainer);

		// Cache DOM elements
		this.chatInput = this.chatbotContainer.querySelector(".chat-input textarea");
		this.sendChatBtn = this.chatbotContainer.querySelector(".chat-input span");
		this.chatbox = this.chatbotContainer.querySelector(".chatbox");
		this.chatbotToggler = this.chatbotContainer.querySelector(".chatbot-toggler");
		this.chatbotCloseBtn = this.chatbotContainer.querySelector(".close-btn");

		// Set initial textarea height
		this.inputInitHeight = this.chatInput.scrollHeight;
	}

	// Set up event listeners
	setupEventListeners() {
		this.sendChatBtn.addEventListener("click", () => this.handleChat());
		this.chatbotToggler.addEventListener("click", () => this.toggleChatbot());
		this.chatbotCloseBtn.addEventListener("click", () => this.hideChatbot());

		this.chatInput.addEventListener("input", () => this.adjustTextareaHeight());
		this.chatInput.addEventListener("keydown", (e) => this.handleKeydown(e));
	}

	// Handle chat input
	handleChat() {
		this.userMessage = this.chatInput.value.trim();

		// Ignore empty messages or if already loading
		if (!this.userMessage || this.isLoading) return;


		this.isLoading = true;
		this.clearInput();
		this.appendMessage(this.userMessage, "outgoing");

		// Check rate limit
		if (this.isRateLimitExceeded()) {
			const incomingChatLi = this.appendMessage(this.config.RATE_LIMIT_ERROR_MESSAGE, "incoming");
			incomingChatLi.querySelector("p").classList.add("error");
			this.isLoading = false;
			return;
		}

		// Increment message count
		this.messageCount++;

		setTimeout(() => {
			const incomingChatLi = this.appendMessage(this.config.THINKING_MESSAGE, "incoming");
			this.generateResponse(incomingChatLi);
		}, this.config.LOADING_DELAY);
	}

	// Check if the rate limit is exceeded
	isRateLimitExceeded() {
		const currentTime = Date.now();

		// Reset the counter if the time window has passed
		if (this.rateLimitStartTime && (currentTime - this.rateLimitStartTime) > 60000) {
			this.messageCount = 0;
			this.rateLimitStartTime = currentTime;
		}

		// Initialize the start time if not set
		if (!this.rateLimitStartTime) {
			this.rateLimitStartTime = currentTime;
		}

		// Check if the message count exceeds the limit
		return this.messageCount >= this.config.MAX_MESSAGES_PER_MINUTE;
	}

	// Append a message to the chatbox
	appendMessage(message, className) {
		const chatLi = document.createElement("li");
		chatLi.classList.add("chat", className);
		let chatContent = className === "outgoing" ?
			`<p></p>` :
			`${this.config.MERCHANT_LOGO ?
				`<img src="${this.config.MERCHANT_LOGO}" class="merchant-logo"/>` :
				'<span class="material-symbols-outlined">smart_toy</span>'
			}
			<p${!message ? ' class="thinking-dots"><span></span><span></span><span></span>' : '>'}</p>`;
		chatLi.innerHTML = chatContent;
		if (message)
			chatLi.querySelector("p").textContent = message
		this.chatbox.appendChild(chatLi);
		this.scrollChatbox();
		return chatLi;
	}

	// Generate a response from the API
	async generateResponse(incomingChatLi) {
		const messageElement = incomingChatLi.querySelector("p");

		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), this.config.TIMEOUT);

			const response = await fetch(this.config.API_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query: this.userMessage, history: [] }),
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let isFirstChunk = true;

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value, { stream: true });
				messageElement.innerHTML = isFirstChunk ? chunk : messageElement.innerHTML + chunk;
				isFirstChunk = false;
				this.scrollChatbox();
			}
		} catch (error) {
			messageElement.classList.add("error");
			messageElement.textContent = this.config.ERROR_MESSAGE;
			console.error("Fetch error:", error);
		} finally {
			this.isLoading = false;
		}
	}

	// Adjust textarea height based on content
	adjustTextareaHeight() {
		this.chatInput.style.height = `${this.inputInitHeight}px`;
		this.chatInput.style.height = `${this.chatInput.scrollHeight}px`;
	}

	// Handle Enter key press
	handleKeydown(e) {
		if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 490) {
			e.preventDefault();
			this.handleChat();
		}
	}

	// Clear the input field
	clearInput() {
		this.chatInput.value = '';
		this.chatInput.style.height = `${this.inputInitHeight}px`;
	}

	// Scroll the chatbox to the bottom
	scrollChatbox() {
		this.chatbox.scrollTo(0, this.chatbox.scrollHeight);
	}

	// Toggle chatbot visibility
	toggleChatbot() {
		this.chatbotContainer.classList.toggle("show-chatbot");
	}

	// Hide the chatbot
	hideChatbot() {
		this.chatbotContainer.classList.remove("show-chatbot");
	}
}

// const chatbotConfig = {
// 	MERCHANT_NAME: "Yuge Roast",
// 	// MERCHANT_LOGO: "../images/13330989.png",
// 	API_URL: "https://yuge-roast.onrender.com/chat",
// 	BRAND_NAME: "AILIIEN",
// 	BRAND_LOGO: "../images/logo_no_bg.png",
// 	BRAND_URL: "https://ailiien.com",
// 	BRAND_COLOR: "#724ae8",
// 	TIMEOUT: 10000, // 10 seconds timeout
// };

// // Usage
// const chatbot = new Chatbot(chatbotConfig);
