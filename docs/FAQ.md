# Frequently Asked Questions

## General Questions

### What is League Deceiver?

League Deceiver is a tool that allows you to appear offline in Riot Games titles (League of Legends, VALORANT, Legends of Runeterra, and 2XKO) while still being able to use all features normally.

### Is this safe to use? Will I get banned?

Riot has [confirmed](https://i.thijsmolendijk.nl/deceive_ok.png) that you won't get banned for using Deceive. However, they also noted that it may break at any time if they change their systems.

### How is this different from the original Deceive?

League Deceiver is a TypeScript/Node.js port of the [original Deceive](https://github.com/molenzwiebel/Deceive) which was written in C#. Key differences:

- **Cross-platform**: Works on Windows, macOS, and Linux
- **No .NET required**: Uses Node.js instead of .NET Framework
- **Open source**: Same GPL-3.0 license as the original

## Functionality

### Can I still invite people?

Yes! Your friends list works normally. You can invite anyone to your party.

### Can people invite me?

No. When you appear offline, friends cannot invite you - even if they type your name manually.

### Can I chat in lobbies and champion select?

Yes! League Deceiver only hides your global presence. You can chat normally in:

- Game lobbies
- Champion/agent select
- Post-game screens

### Does this work with parties?

Yes! You can:

- Create parties
- Invite friends
- Queue together

Your friends in the party will see you as online within the party context.

### Can I message friends while appearing offline?

Yes, you can send messages to friends. However, they will see you as offline in their friends list.

## Technical Questions

### Why do I need to close the Riot Client first?

League Deceiver needs to launch the Riot Client with special parameters to redirect chat connections. If the client is already running, it can't intercept the traffic.

### The game shows me as online. Is it working?

Yes! The game client always shows you as online to yourself - this is normal. Your friends see you as offline. Look for the "Deceive Active!" friend in your friends list to confirm it's working.

### How do I change my status?

You can change your status by:

1. **CLI flags**: `league-deceiver launch lol --status mobile`
2. **In-game messages**: Send messages to "Deceive Active!" friend:
   - `offline` - Appear offline
   - `mobile` - Appear on mobile
   - `online` - Appear online

### What does "mobile" status do?

Mobile status makes you appear as if you're using the Riot mobile app. Friends see you with a phone icon instead of completely offline.

### Does this affect my ping or connection?

No. League Deceiver only intercepts chat/presence traffic. Game traffic goes directly to Riot's servers.

## Troubleshooting

### League Deceiver can't find my Riot Client

Make sure you've launched any Riot game at least once. The Riot Client installation is detected from:

- **Windows**: `C:\ProgramData\Riot Games\RiotClientInstalls.json`
- **macOS**: `/Applications/Riot Client.app`

### The chat proxy won't start

Make sure no other application is using the required ports. League Deceiver uses random available ports, but firewalls may block them.

### I can't see the "Deceive Active!" friend

This friend should appear shortly after connecting. If it doesn't:

1. Check that League Deceiver is still running
2. Try restarting both League Deceiver and the game
3. Check the console output for errors

### My friends can still see me online

Make sure:

1. You launched the game through League Deceiver
2. The "Deceive Active!" friend appears in your list
3. Your status is set to "offline" not "online"

### The game won't launch

1. Check that the Riot Client path is correct
2. Try running League Deceiver as administrator
3. Check for error messages in the console

## Platform-Specific

### Windows

League Deceiver should work out of the box on Windows 10/11.

### macOS

You may need to allow the application in System Preferences > Security & Privacy.

### Linux

Linux support is limited. You'll need:

- A working Wine/Lutris setup
- The Riot Client accessible in your path

## Updates

### How do I update League Deceiver?

- **Binary release**: Download the latest version from [Releases](https://github.com/username/league-deceiver/releases)
- **npm**: Run `npm update -g league-deceiver` (if installed via npm)
- **Source**: Pull the latest changes (`git pull`) and rebuild (`bun install && bun run build`)

### Will my settings be preserved after updates?

Yes, configuration is stored separately from the application.
