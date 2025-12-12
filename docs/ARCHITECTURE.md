# Architecture

This document describes the high-level architecture of League Deceiver.

## Module Structure

```
src/
├── index.ts              # Entry point, CLI parsing
├── startup.ts            # Application startup orchestration
├── controller.ts         # Main controller, manages connections and status
├── types.ts              # TypeScript types and enums
│
├── proxy/
│   ├── config-proxy.ts   # HTTP proxy for Riot config
│   ├── proxied-connection.ts  # TLS connection proxy
│   └── certificate.ts    # Certificate generation
│
├── launcher/
│   ├── game-launcher.ts  # Launch games with proxy config
│   └── process-manager.ts # Detect and manage processes
│
├── ui/
│   ├── cli.ts            # CLI prompts and output
│   └── tray.ts           # System tray interface
│
├── config/
│   └── config.ts         # Configuration management
│
└── utils/
    ├── logger.ts         # Logging utility
    ├── platform.ts       # Platform detection
    └── version.ts        # Version information
```

## Component Diagram

```mermaid
flowchart TB
    subgraph Entry [Entry Points]
        CLI[CLI - index.ts]
    end

    subgraph Core [Core]
        Startup[startup.ts]
        Controller[controller.ts]
    end

    subgraph Proxy [Proxy Layer]
        ConfigProxy[config-proxy.ts]
        ProxiedConn[proxied-connection.ts]
        Cert[certificate.ts]
    end

    subgraph Launcher [Launcher]
        GameLauncher[game-launcher.ts]
        ProcessMgr[process-manager.ts]
    end

    subgraph UI [User Interface]
        CLIPrompt[cli.ts]
        Tray[tray.ts]
    end

    subgraph Config [Configuration]
        ConfigMgr[config.ts]
    end

    CLI --> Startup
    Startup --> Controller
    Startup --> ConfigProxy
    Startup --> GameLauncher
    
    Controller --> ProxiedConn
    Controller --> Tray
    
    ConfigProxy --> Cert
    ProxiedConn --> Cert
    
    GameLauncher --> ProcessMgr
    
    Startup --> CLIPrompt
    Startup --> ConfigMgr
```

## Data Flow

### Startup Sequence

```mermaid
sequenceDiagram
    participant User
    participant CLI as CLI Parser
    participant Startup
    participant ProcessMgr as Process Manager
    participant ConfigProxy as Config Proxy
    participant Controller
    participant Launcher as Game Launcher

    User->>CLI: Run command
    CLI->>Startup: startDeceive(game, status)
    
    Startup->>ProcessMgr: isClientRunning()
    ProcessMgr-->>Startup: true/false
    
    alt Client is running
        Startup->>ProcessMgr: killProcesses()
    end
    
    Startup->>ProcessMgr: getRiotClientPath()
    ProcessMgr-->>Startup: path
    
    Startup->>ConfigProxy: new ConfigProxy(chatPort)
    Startup->>ConfigProxy: start()
    
    Startup->>Controller: new MainController(status)
    
    ConfigProxy->>Startup: emit('patchedChatServer')
    Startup->>Controller: startServingClients()
    
    Startup->>Launcher: launchRiotClient()
```

### Presence Modification Flow

```mermaid
sequenceDiagram
    participant RC as Riot Client
    participant Incoming as TLS Socket (In)
    participant ProxiedConn as Proxied Connection
    participant Outgoing as TLS Socket (Out)
    participant Server as Riot Chat Server

    RC->>Incoming: XMPP Presence Stanza
    Incoming->>ProxiedConn: data event
    
    ProxiedConn->>ProxiedConn: Check for presence tag
    
    alt Contains presence
        ProxiedConn->>ProxiedConn: rewriteAndSendPresence()
        Note over ProxiedConn: Modify show, remove games
        ProxiedConn->>Outgoing: Modified stanza
    else Other data
        ProxiedConn->>Outgoing: Forward unchanged
    end
    
    Outgoing->>Server: Send data
```

## Key Classes

### MainController

The central orchestrator that manages:
- Application state (enabled, status)
- Active connections
- System tray integration
- Status change broadcasts

```typescript
class MainController {
  status: PresenceStatus;
  enabled: boolean;
  connections: ProxiedConnection[];
  
  startServingClients(server, chatHost, chatPort): void;
  setStatus(newStatus: PresenceStatus): Promise<void>;
  toggleEnabled(): Promise<void>;
  handleChatMessage(content: string): Promise<void>;
}
```

### ConfigProxy

HTTP server that intercepts Riot configuration requests:

```typescript
class ConfigProxy extends EventEmitter {
  port: number;
  chatPort: number;
  
  start(): Promise<void>;
  stop(): void;
  
  // Events
  on('patchedChatServer', (config: ChatServerConfig) => void);
}
```

### ProxiedConnection

Manages a single client-server connection pair:

```typescript
class ProxiedConnection extends EventEmitter {
  start(): void;
  updateStatus(newStatus: PresenceStatus): Promise<void>;
  sendMessageFromFakePlayer(message: string): Promise<void>;
  close(): void;
  
  // Events
  on('error', (err: Error) => void);
}
```

## Configuration

Configuration is managed using the `conf` package with the following schema:

```typescript
interface AppConfig {
  defaultGame: LaunchGame;      // Default game to launch
  defaultStatus: PresenceStatus; // Default status (offline)
  lastPromptedVersion: string;   // For update prompts
  connectToMuc: boolean;         // Allow lobby chat
}
```

## Error Handling

1. **Connection Errors**: Individual connections emit 'error' events and are removed from the pool
2. **Proxy Errors**: Logged and returned as appropriate HTTP status codes
3. **Startup Errors**: Logged with helpful messages, application exits gracefully

## Threading Model

League Deceiver is single-threaded using Node.js's event loop:

- All I/O is non-blocking
- Connections are handled asynchronously
- No explicit threading required

## Testing Strategy

1. **Unit Tests**: Individual functions and methods
2. **Integration Tests**: Component interactions
3. **Mock Tests**: Network operations with mocked sockets

See the `test/` directory for test implementations.

