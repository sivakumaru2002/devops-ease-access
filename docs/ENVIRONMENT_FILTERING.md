# Environment Filtering Feature

## Overview
Users can now filter resources by environment to easily find and manage resources across different deployment stages (dev, stage, prod, etc.).

## Features

### 🌐 Environment Selector
- **Location**: Below the dashboard selector in the "Resources in Selected Dashboard" section
- **Options**: 
  - "All Environments" - Shows all resources
  - Individual environments (dynamically populated from available resources)

### 📊 Resource Count Badge
- Shows the number of resources currently displayed
- Updates dynamically based on filter selection
- Format:
  - When "All Environments" selected: `"X total"`
  - When specific environment selected: `"X in {environment}"`

### 🎯 How It Works

#### For Admins:
1. **Select a Dashboard** from the dropdown
2. **Choose Environment Filter** 
   - Select "🌐 All Environments" to see all resources
   - Or select specific environment (e.g., "stage", "prod", "preprod")
3. **View Filtered Resources**
   - Resources are grouped by Project and Environment
   - Only selected environment resources are shown
4. **Add Resources** - Form remains available regardless of filter

#### For Users (View-Only):
1. **Select a Dashboard** from the dropdown
2. **Choose Environment Filter** to narrow down the view
3. **Browse Resources** for the selected environment
4. Access URLs and view resource details

## UI Components

### Environment Filter Dropdown
```tsx
<select value={selectedEnvironmentFilter} onChange={...}>
  <option value="all">🌐 All Environments</option>
  <option value="stage">stage</option>
  <option value="prod">prod</option>
  <option value="preprod">preprod</option>
  // ... dynamically generated from resources
</select>
```

### Resource Count Badge
```tsx
<span className="badge badge-user">
  {count} {filter === 'all' ? 'total' : `in ${filter}`}
</span>
```

## Benefits

### 📋 For Users
- **Faster Navigation**: Quickly find resources for specific environment
- **Reduced Clutter**: Don't see irrelevant environments
- **Better Focus**: Work with one environment at a time
- **Clear Context**: Count badge shows exactly how many resources match

### 👑 For Admins
- All user benefits, plus:
- **Easier Management**: Review resources by environment
- **Quick Verification**: Ensure all environments have necessary resources
- **Audit Support**: Check environment-specific configurations

## Example Usage Scenarios

### Scenario 1: Production Deployment Check
```
1. Select "Production Dashboard"
2. Filter by "prod" environment
3. Review all production resources (databases, storage, etc.)
4. Verify URLs and configurations
```

### Scenario 2: Staging Environment Setup
```
1. Select "GPMD Dashboard"
2. Filter by "stage" environment
3. Admin: Add new staging resource
4. Verify resource appears in filtered view
```

### Scenario 3: Cross-Environment Review
```
1. Select dashboard
2. Start with "All Environments" (see everything)
3. Switch to "prod" (check production)
4. Switch to "stage" (compare staging)
5. Switch to "preprod" (verify preprod matches prod)
```

## Technical Implementation

### State Management
```tsx
const [selectedEnvironmentFilter, setSelectedEnvironmentFilter] = useState('all');
```

### Available Environments (Dynamic)
```tsx
const availableEnvironments = useMemo(() => {
  const envSet = new Set<string>();
  for (const item of dashboardResources) {
    envSet.add(item.environment);
  }
  return Array.from(envSet).sort();
}, [dashboardResources]);
```

### Filtered Resources
```tsx
const filteredDashboardResources = useMemo(() => {
  if (selectedEnvironmentFilter === 'all') {
    return dashboardResources;
  }
  return dashboardResources.filter(
    item => item.environment === selectedEnvironmentFilter
  );
}, [dashboardResources, selectedEnvironmentFilter]);
```

### Grouped Display
```tsx
const groupedDashboardResources = useMemo(() => {
  const grouped: Record<string, DashboardResourceItem[]> = {};
  for (const item of filteredDashboardResources) {
    const key = `${item.project}::${item.environment}`;
    grouped[key] = grouped[key] ?? [];
    grouped[key].push(item);
  }
  return grouped;
}, [filteredDashboardResources]);
```

## Empty States

### No Dashboard Selected
```
"Select a dashboard above to view its resources."
```

### No Resources in Dashboard
```
"📭 No resources added yet for this dashboard."
```

### No Resources for Selected Environment
```
"🔍 No resources found for environment: {selectedEnvironment}"
```

## Filter Behavior

| Dashboard Selected | Resources Available | Filter Enabled | Display |
|-------------------|---------------------|----------------|---------|
| ❌ No | - | ❌ No | Empty state message |
| ✅ Yes | ❌ No | ❌ No | No resources message |
| ✅ Yes | ✅ Yes | ✅ Yes | Filtered resources |

## Visual Design

### Filter Section Layout
```
┌─────────────────────────────────────────────────────┐
│ 📋 Resources in Selected Dashboard   [5 in stage]   │
├─────────────────────────────────────────────────────┤
│ [Filter by Environment ▼]  [🔄 Refresh Resources]   │
│  ┌────────────────────┐                             │
│  │ 🌐 All Environments│                             │
│  │ stage              │                             │
│  │ prod               │                             │
│  │ preprod            │                             │
│  └────────────────────┘                             │
└─────────────────────────────────────────────────────┘
```

### Resource Groups (Filtered)
```
┌─────────────────────────────────────────────────────┐
│ GPMD · stage                                         │
├─────────────────────────────────────────────────────┤
│ 📦 storage-account-stage                            │
│ 🔗 https://...                                       │
│ ✏️ Edit                                              │
├─────────────────────────────────────────────────────┤
│ 📦 database-stage                                    │
│ 🔗 https://...                                       │
│ ✏️ Edit                                              │
└─────────────────────────────────────────────────────┘
```

## Performance

### Optimizations
- **useMemo**: Environments list only recalculated when resources change
- **useMemo**: Filtered resources only recalculated when filter or resources change
- **useMemo**: Grouping only recalculated when filtered results change
- No unnecessary re-renders

### Scalability
- Handles hundreds of resources efficiently
- Filter operation is O(n) where n = number of resources
- Grouping operation is O(filtered) which is typically much smaller

## Future Enhancements

Potential improvements:
1. **Multi-Environment Select**: Select multiple environments at once
2. **Environment Comparison**: Side-by-side view of multiple environments
3. **Search Within Filter**: Combine environment filter with text search
4. **URL State**: Save filter selection in URL parameters
5. **Local Storage**: Remember last selected environment per dashboard
6. **Quick Filters**: Preset filters like "Production Only" or "Non-Prod"
7. **Color Coding**: Different colors for different environment types

## Summary

The environment filtering feature provides:
- ✅ Easy navigation across environments
- ✅ Clear visual feedback with count badges
- ✅ No resources found state when filter yields no results
- ✅ Maintains admin functionality (can still add resources)
- ✅ Responsive design with flexbox layout
- ✅ Disabled state when no dashboard selected
- ✅ Dynamic environment list from actual data
- ✅ Performant with React useMemo hooks
