#!/bin/bash
echo "Checking deployment status..."
curl -s http://localhost:3000/health
echo "
Member count:"
curl -s http://localhost:3000/api/member-count
echo "
Verifying SOLAR amounts:"
curl -s http://localhost:3000/api/members.json | grep -A2 "Terry" | grep total_solar
curl -s http://localhost:3000/api/members.json | grep -A2 "JF" | grep total_solar
echo "
John D Test User:"
curl -s http://localhost:3000/api/members.json | grep -A2 "John D"