#!/bin/bash
# The Current-See Startup Script
# This script starts both the main server and health check server

# Function to handle cleanup on exit
cleanup() {
  echo "Shutting down services..."
  
  # Kill server processes if they exist
  if [ -f server.pid ]; then
    SERVER_PID=$(cat server.pid)
    if ps -p $SERVER_PID > /dev/null; then
      echo "Stopping server process (PID: $SERVER_PID)"
      kill $SERVER_PID
    fi
    rm server.pid
  fi
  
  if [ -f health.pid ]; then
    HEALTH_PID=$(cat health.pid)
    if ps -p $HEALTH_PID > /dev/null; then
      echo "Stopping health check process (PID: $HEALTH_PID)"
      kill $HEALTH_PID
    fi
    rm health.pid
  fi
  
  if [ -f monitor.pid ]; then
    MONITOR_PID=$(cat monitor.pid)
    if ps -p $MONITOR_PID > /dev/null; then
      echo "Stopping monitor process (PID: $MONITOR_PID)"
      kill $MONITOR_PID
    fi
    rm monitor.pid
  fi
  
  exit 0
}

# Set up trap for clean shutdown
trap cleanup EXIT INT TERM

# Check for stale PID files
if [ -f server.pid ]; then
  SERVER_PID=$(cat server.pid)
  if ! ps -p $SERVER_PID > /dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: Found stale PID file. Previous instance may have crashed. Removing."
    rm server.pid
  fi
fi

if [ -f health.pid ]; then
  HEALTH_PID=$(cat health.pid)
  if ! ps -p $HEALTH_PID > /dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: Found stale health check PID file. Removing."
    rm health.pid
  fi
fi

# Archive previous log files if they exist
if [ -f server.log ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Archiving previous log file to server.log.old"
  mv server.log server.log.old
fi

# Start health check server
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting health check server on port 3000"
node healthz.js > health.log 2>&1 &
HEALTH_PID=$!
echo $HEALTH_PID > health.pid
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health check server started with PID $HEALTH_PID"

# Start The Current-See server
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting The Current-See server on port 8080"
node server.js > server.log 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > server.pid
echo "[$(date '+%Y-%m-%d %H:%M:%S')] The Current-See server started with PID $SERVER_PID"

# Start the monitor service
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting server monitor"
node monitor.js > monitor.log 2>&1 &
MONITOR_PID=$!
echo $MONITOR_PID > monitor.pid
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server monitor started with PID $MONITOR_PID"

# Wait a moment for servers to initialize
sleep 2

# Check if servers started successfully
if ps -p $SERVER_PID > /dev/null && ps -p $HEALTH_PID > /dev/null && ps -p $MONITOR_PID > /dev/null; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Server successfully started and running"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Logs are being written to server.log"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Use 'tail -f server.log' to view logs in real-time"
  echo ""
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] The Current-See is now running at:"
  echo "  http://localhost:8080/"
  echo ""
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] API endpoints available at:"
  echo "  http://localhost:8080/api/solar-clock"
  echo "  http://localhost:8080/api/analyze-product"
  echo ""
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Health check endpoint available at:"
  echo "  http://localhost:3000/healthz"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Failed to start all services"
  
  # Clean up any processes that did start
  cleanup
  
  exit 1
fi