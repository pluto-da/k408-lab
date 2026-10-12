import os, paramiko,sys
k=paramiko.Ed25519Key.from_private_key_file(os.environ.get('K408_SSH_KEY', '<PATH_TO_SSH_PRIVATE_KEY>'))
c=paramiko.SSHClient();c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(os.environ.get('K408_HOST', '154.8.183.93'),username='root',pkey=k,timeout=20,allow_agent=False,look_for_keys=False)
cmd=sys.stdin.read()
_,o,e=c.exec_command(cmd,get_pty=True,timeout=1800)
for line in iter(o.readline,''): print(line,end='',flush=True)
print('EXIT',o.channel.recv_exit_status())
