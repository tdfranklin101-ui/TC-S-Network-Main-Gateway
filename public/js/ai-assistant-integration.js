/**
 * The Current-See AI Assistant Integration
 * 
 * This file integrates the AI Assistant demo page with the live OpenAI backend.
 */

document.addEventListener('DOMContentLoaded', function() {
  // Elements
  const input = document.getElementById('assistant-input');
  const sendButton = document.getElementById('send-button');
  const micButton = document.getElementById('mic-button');
  const chatWindow = document.getElementById('chat-window');
  
  // Add welcome message when page loads
  addMessageToChat(`
    <p>👋 Welcome to The Current-See AI Assistant!</p>
    <p>I can help you with questions about:</p>
    <ul>
      <li>The Current-See solar-backed economic system</li>
      <li>Solar energy and sustainability</li>
      <li>How SOLAR tokens work</li>
      <li>Daily distribution mechanisms</li>
    </ul>
    <p>Feel free to ask a question or try one of the example queries.</p>
  `);
  
  // Example queries
  const exampleQueries = document.querySelectorAll('.example-queries li');
  
  // Function to add a message to the chat window
  function addMessageToChat(message, isUser = false) {
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${isUser ? 'user' : 'assistant'}`;
    
    messageElement.innerHTML = `
      <div class="message-avatar">${isUser ? '👤' : '🤖'}</div>
      <div class="message-content">${message}</div>
    `;
    
    chatWindow.appendChild(messageElement);
    
    // Scroll to bottom of chat
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
  
  // Function to add a loading message
  function showLoading() {
    const loadingElement = document.createElement('div');
    loadingElement.className = 'chat-message assistant loading-message';
    loadingElement.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content loading">Thinking</div>
    `;
    
    chatWindow.appendChild(loadingElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    
    return loadingElement;
  }
  
  // Function to send a query to the AI assistant
  async function sendQuery(query) {
    if (!query.trim()) return;
    
    // Add user query to chat
    addMessageToChat(query, true);
    
    // Show loading state
    const loadingElement = showLoading();
    
    try {
      // Send the query to the server
      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });
      
      // Remove loading message
      if (loadingElement) {
        chatWindow.removeChild(loadingElement);
      }
      
      if (response.ok) {
        const data = await response.json();
        
        // The actual response content is in data.response
        let aiResponse = data.response;
        
        // Handle error responses
        if (aiResponse && aiResponse.error === true) {
          addMessageToChat(`
            <p>I apologize, but I'm currently experiencing technical difficulties. Please try again later.</p>
            <p><em>Error details: ${aiResponse.message || 'Unknown error'}</em></p>
          `);
          return;
        }
        
        // Format the response
        if (typeof aiResponse === 'string') {
          // Replace newlines with <br> tags for proper HTML formatting
          aiResponse = aiResponse.replace(/\n/g, '<br>');
        } else {
          // If it's not a string, it might be an object - stringify it
          aiResponse = JSON.stringify(aiResponse, null, 2);
          aiResponse = `<pre>${aiResponse}</pre>`;
        }
        
        // Display the response
        addMessageToChat(aiResponse);
      } else {
        // Handle HTTP error
        addMessageToChat(`
          <p>I apologize, but I'm currently unable to provide a response. Please try again later.</p>
          <p><em>Server error: ${response.status}</em></p>
        `);
      }
    } catch (error) {
      console.error('Error sending query:', error);
      
      // Remove loading message
      if (loadingElement) {
        chatWindow.removeChild(loadingElement);
      }
      
      addMessageToChat(`
        <p>I apologize, but I'm unable to connect to the server. Please check your internet connection and try again.</p>
        <p><em>Error: ${error.message}</em></p>
      `);
    }
    
    // Clear the input
    input.value = '';
  }
  
  // Send button click event
  sendButton.addEventListener('click', () => {
    if (input.value.trim()) {
      sendQuery(input.value);
    }
  });
  
  // Enter key event
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      sendQuery(input.value);
    }
  });
  
  // Example query click events
  exampleQueries.forEach(item => {
    item.addEventListener('click', () => {
      const query = item.getAttribute('data-query');
      input.value = query;
      sendQuery(query);
    });
  });
  
  // Voice input functionality
  micButton.addEventListener('click', function() {
    // Check if browser supports speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      
      recognition.start();
      micButton.classList.add('listening');
      
      recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        input.value = transcript;
        micButton.classList.remove('listening');
        sendQuery(transcript);
      };
      
      recognition.onerror = function(event) {
        console.error('Speech recognition error:', event.error);
        micButton.classList.remove('listening');
        
        addMessageToChat(`
          <p>I couldn't understand what you said. Please try speaking again or type your question.</p>
          <p><em>Error: ${event.error}</em></p>
        `);
      };
      
      recognition.onend = function() {
        micButton.classList.remove('listening');
      };
    } else {
      addMessageToChat(`
        <p>I'm sorry, but voice input is not supported in your browser. Please try using a modern browser like Chrome, Edge, or Safari.</p>
      `);
    }
  });
});