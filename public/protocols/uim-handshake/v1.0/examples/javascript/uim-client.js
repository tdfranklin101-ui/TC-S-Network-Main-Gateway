/**
 * UIM Protocol Reference Implementation - JavaScript
 */

class UIMClient {
    constructor(nodeId, baseUrl, capabilities, solarEndpoint = null) {
        this.nodeId = nodeId;
        this.baseUrl = baseUrl;
        this.capabilities = capabilities;
        this.solarEndpoint = solarEndpoint;
        this.connectedNodes = new Map();
    }

    generateHelloResponse() {
        return {
            node_id: this.nodeId,
            api_endpoint: `${this.baseUrl}/uim`,
            capabilities: this.capabilities,
            protocol_version: "UIM-HS-1.0",
            public_key: "-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----",
            solar_endpoint: this.solarEndpoint
        };
    }

    async discoverNodes(registryUrl, capabilityFilter = null) {
        try {
            const response = await fetch(registryUrl);
            const nodes = await response.json();
            
            const filteredNodes = capabilityFilter 
                ? nodes.filter(node => node.capabilities?.includes(capabilityFilter))
                : nodes;
            
            filteredNodes.forEach(node => {
                this.connectedNodes.set(node.node_id, node);
            });
            
            return filteredNodes;
        } catch (error) {
            console.error('Discovery failed:', error);
            return [];
        }
    }

    async sendTaskProposal(targetNode, taskType, inputContext, maxSolarBudget = 0.001) {
        const taskProposal = {
            task_id: `task_${Math.random().toString(36).substr(2, 9)}`,
            proposing_node: this.nodeId,
            task_type: taskType,
            input_context: inputContext,
            expected_output_format: "markdown_bullets",
            max_solar_budget: maxSolarBudget,
            required_rights_alignment: ["privacy", "non_discrimination"]
        };

        try {
            const response = await fetch(`${targetNode.api_endpoint}/task`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(taskProposal)
            });
            
            return await response.json();
        } catch (error) {
            return { error: error.message, task_id: taskProposal.task_id };
        }
    }
}

// Example usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIMClient;
    
    // Demo
    const client = new UIMClient(
        "test-node-js-001",
        "https://api.example.com",
        ["text-generation", "code-execution"],
        "https://api.example.com/solar"
    );
    
    console.log("Hello Response:", JSON.stringify(client.generateHelloResponse(), null, 2));
}
