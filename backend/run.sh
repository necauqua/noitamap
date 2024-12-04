#!/bin/bash

# So the proper way to do this is to have a separate container for backend
# instead of this amazing systemd rewrite
#
# But I've no idea how the frontend container is deployed, so for now
# I'm mimicking it - aka the final container still does everything like it did
# except now it also has the backend thing embedded too lol

node dist/main.js &
BACKEND_PID=$!

nginx -g 'daemon off;' &
NGINX_PID=$!

on_exit() { 
  echo "Shutting down gracefully..."
  kill $BACKEND_PID
  kill $NGINX_PID
  exit
}

trap on_exit SIGINT
trap on_exit SIGTERM

while true; do
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "Backend died. Shutting down..."
        kill $NGINX_PID
        break
    fi

    if ! kill -0 $NGINX_PID 2>/dev/null; then
        echo "Nginx died. Shutting down..."
        kill $BACKEND_PID
        break
    fi

    sleep 1
done

# we died idk
exit 1
