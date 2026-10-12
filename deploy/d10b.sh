cd /opt/k408
setsid -f sh -c 'docker compose up -d --build > /root/d10.log 2>&1; echo BUILD_DONE $? >> /root/d10.log' < /dev/null > /dev/null 2>&1
sleep 3; echo started; ls -la /root/d10.log
