"""
UIM Protocol Reference Implementation - Python
"""

import requests
import json
import time
import uuid

class UIMClient:
    def __init__(self, node_id, base_url, capabilities, solar_endpoint=None):
        self.node_id = node_id
        self.base_url = base_url
        self.capabilities = capabilities
        self.solar_endpoint = solar_endpoint
        self.connected_nodes = {}
        
    def generate_hello_response(self):
        """Generate a HELLO_RESPONSE for this node"""
        return {
            "node_id": self.node_id,
            "api_endpoint": f"{self.base_url}/uim",
            "capabilities": self.capabilities,
            "protocol_version": "UIM-HS-1.0",
            "public_key": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",  # Placeholder
            "solar_endpoint": self.solar_endpoint
        }
    
    def discover_nodes(self, registry_url, capability_filter=None):
        """Discover other UIM nodes from registry"""
        try:
            response = requests.get(registry_url, timeout=10)
            nodes = response.json()
            
            if capability_filter:
                nodes = [node for node in nodes 
                        if capability_filter in node.get('capabilities', [])]
            
            self.connected_nodes = {node['node_id']: node for node in nodes}
            return nodes
            
        except requests.RequestException as e:
            print(f"Discovery failed: {e}")
            return []
    
    def send_task_proposal(self, target_node, task_type, input_context, max_solar_budget=0.001):
        """Send a task proposal to another UIM node"""
        task_proposal = {
            "task_id": f"task_{uuid.uuid4().hex[:8]}",
            "proposing_node": self.node_id,
            "task_type": task_type,
            "input_context": input_context,
            "expected_output_format": "markdown_bullets",
            "max_solar_budget": max_solar_budget,
            "required_rights_alignment": ["privacy", "non_discrimination"]
        }
        
        try:
            target_endpoint = f"{target_node['api_endpoint']}/task"
            response = requests.post(target_endpoint, 
                                   json=task_proposal,
                                   timeout=30)
            return response.json()
        except requests.RequestException as e:
            return {"error": str(e), "task_id": task_proposal["task_id"]}

# Example usage
if __name__ == "__main__":
    client = UIMClient(
        node_id="test-node-python-001",
        base_url="https://api.example.com",
        capabilities=["text-generation", "reasoning"],
        solar_endpoint="https://api.example.com/solar"
    )
    
    print("Hello Response:", json.dumps(client.generate_hello_response(), indent=2))
