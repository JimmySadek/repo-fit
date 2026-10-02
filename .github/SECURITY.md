# Security

repo-fit runs locally, writes nothing without `--apply`, never pushes, and never sends your files anywhere. The README's "Security and privacy" section lists exactly what it reads and the two commands that touch the network.

**Found a problem?** Open a private report through GitHub's "Report a vulnerability" button on this repository (Security tab), or open an issue if the problem is not sensitive. Say which version (`VERSION` or `node bin/repo-fit.mjs help`) and which command. You will get an answer, and a fix or a stated reason, as fast as one maintainer can manage.

What counts: anything that makes repo-fit write outside the target repo, overwrite a file, commit or push on its own, print a secret, or run a command it should not.
