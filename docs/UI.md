# UI Design Requirements

## Overview
Intelli-Mock's Web UI is a thin, standards-based interface built with **Lit Element** and **Material Web Components (M3)**. The design philosophy is minimalist, high-contrast, and focused on developer productivity.

## Mockups
Interactive HTML mockups for the core UI components are available in the [docs/mockups](./mockups/) directory:

- [Mock Endpoints List View](./mockups/mock-endpoints.html)
- [Mock Detail & Editor (with AI)](./mockups/mock-ai-generator.html)
- [Traffic Log Viewer](./mockups/mock-details.html)
- [Settings Page](./mockups/settings.html)

## Branding & Visual Identity
- **Color Palette**:
    - **Primary**: Red (`#D32F2F`) - Used for primary actions, active states, and branding.
    - **Background**: White (`#FFFFFF`) - Main content areas.
    - **Surface/Text**: Black (`#000000`) - High-contrast text and borders.
    - **Accents**: Subtle Grays (`#F5F5F5`, `#E0E0E0`) - Inactive states, dividers, and secondary backgrounds.
- **Typography**: Sans-serif (Roboto or system default).
- **Style**: Minimalist, flat, leveraging Material Design 3 design tokens for consistent spacing and elevation.

## Layout Structure
The application follows a standard **App Shell** pattern:

1. **Left-Side Navigation (Sidebar)**:
    - Fixed position.
    - Background: Black or very dark gray.
    - Elements:
        - App Logo (Red icon).
        - Navigation List:
            - `Mocks` (Mock endpoint list)
            - `Traffic` (Traffic log viewer)
            - `Settings` (Tenant/Auth config)
        - Bottom: User/Tenant profile chip.

2. **Top Header**:
    - Sticky position.
    - Elements:
        - Breadcrumbs or View Title (e.g., "Mocks > /api/users").
        - Action Buttons (context-specific, e.g., "Create Mock").
        - Tenant Indicator.

3. **Main Content Area**:
    - White background.
    - Scrollable.
    - Large padded container for tables, forms, and editors.

## Component & Page Specifications

### 1. Mock Endpoint List View (`<mock-list>`)
*Main dashboard for managing all mocks within the current tenant. See [Mockup](./mockups/mock-endpoints.html).*

- **Header Section**:
    - **Search Bar**: Centered `md-outlined-text-field` with "Filter by path or method..."
    - **Action Group**: `md-filled-button` (Red) labeled "Create New Mock".
- **Empty State**: 
    - Illustration or large icon with "No mocks found".
    - "Get started by creating your first mock" text + action button.
- **Main Table (`md-list` or custom table)**:
    - **Method Badge**: High-contrast badges (e.g., GET is Blue, POST is Green, DELETE is Red).
    - **Path Column**: Displays the `pathPattern` (e.g., `/api/v1/users/:id`).
    - **Status Column**: `md-assist-chip` or dot indicator showing `Active` (Green), `Draft` (Gray), or `Deactivated` (Red).
    - **Row Actions**: IconButton for "Edit" (leads to Detail View) and "Delete" (triggers confirmation dialog).

### 2. Mock Detail & Editor View (`<mock-detail>`)
*Comprehensive editor for a single mock endpoint, including configuration and script management. See [Mockup](./mockups/mock-ai-generator.html).*

- **Navigation**: "Back to List" button in the top-left header.
- **Left Column / Top Section (Configuration)**:
    - **Primary Form**: Fields for Path, Method dropdown, Priority slider, and Proxy URL.
    - **Status Toggle**: Large `md-switch` labeled "Endpoint Active".
- **Right Column / Bottom Section (Navigation Tabs)**:
    - **Tab 1: Script Editor**:
        - CodeMirror 6 instance taking up full available height.
        - Toolbar: "Regenerate with AI" (Red button), "Save Version", and Version History dropdown.
    - **Tab 2: Sample Pairs**:
        - List of existing samples with "Add Sample" action.
        - Status bar showing "X of 5 samples collected for AI generation".
    - **Tab 3: Try-It**:
        - Integrated `<try-it-panel>` for testing the current active script.

### 3. AI Script Generation Experience
*The workflow for transforming samples into a functional mock. See [Mockup](./mockups/mock-ai-generator.html).*

- **AI Assistant Button**: A floating action button (FAB) available in the editor to trigger the AI chat/assistant for script modifications or explanations.

- **Trigger**: The "Generate with AI" button in the Script Editor tab.
- **Validation**: If < 5 samples, show a tooltip or disabled state explaining the requirement.
- **Loading State**: An overlay with `md-circular-progress` and status messages like "Analyzing patterns...", "Generating logic...".
- **Result**: Once generated, the new script is shown in the editor with a "Draft" banner until saved/activated.

### 4. Sample Pair Editor (`<sample-editor>`)
*Granular control over the training data for the AI.*

- **Card-based List**: Each sample pair is an `md-elevated-card`.
- **Expanded State**:
    - **Request Section**: JSON editor showing Method, Path, Headers, and Body.
    - **Response Section**: JSON editor showing Status Code, Headers, and Body.
- **Source Badge**: Indicator if the sample was "Manually Added" or "Captured via Proxy".

### 5. Try-It Panel (`<try-it-panel>`)
*Direct API testing tool for validating mock behavior.*

- **Request Builder**:
    - Input fields for dynamic path parameters (automatically parsed from the route pattern).
    - Header/Query parameter builders (key-value rows).
    - Body editor for POST/PUT.
- **Response Display**:
    - Status code with semantic coloring (2xx Green, 4xx/5xx Red).
    - Latency indicator (e.g., "Mock responded in 12ms").
    - Formatted JSON output with "Copy to Clipboard" button.

### 6. Traffic Log Viewer (`<traffic-log-viewer>`)
*Audit trail and debugging tool for all incoming traffic. See [Mockup](./mockups/mock-details.html).*

- **Filter Bar**: Filter by Method, Status Code, and "Mock Hit" vs "Proxy Pass-through".
- **Log Table**:
    - Condensed rows showing Timestamp, Method, Path, and Result.
- **Details Drawer**: Clicking a log entry opens a right-side drawer (or bottom sheet) containing:
    - Full request/response details.
    - Matcher metadata (which route was matched, or why a match failed).
    - Button: "Save as Sample" (to quickly promote real traffic to a mock sample).

### 7. Settings Page (`<settings-panel>`)
*Global and tenant-level configuration. See [Mockup](./mockups/settings.html).*
- **Tenant Section**: View Slug, Name, and total usage metrics.
- **Auth Section**: Display JWT Issuer and Algorithm used by the instance.
- **AI Config**: Configure the Ollama/OpenAI endpoint and model being used.
- **Proxy Config**: Global proxy timeout and fallback settings.

## Interactive Elements
- **Buttons**: All primary buttons use `md-filled-button` with red background.
- **Toggles**: `md-switch` for activation states.
- **Feedback**: `md-snackbar` for success/error notifications (e.g., "Script generated successfully").
- **Loading**: `md-linear-progress` at the top of the content area during API calls.
