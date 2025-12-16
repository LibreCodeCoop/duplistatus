# GitHub Actions Workflows

## Docker Image Build and Publish

This workflow automatically builds and publishes Docker images to GitHub Container Registry (GHCR).

### Workflow File
- `.github/workflows/docker-publish.yml`

### Triggers

The workflow runs on:

1. **Push to branches**:
   - `master` or `main` → Published as `latest`
   - `develop` → Published with branch name tag
   - Other branches → Published with branch name tag

2. **Tags**:
   - `v*` (e.g., `v1.0.0`) → Published with semantic version tags

3. **Pull Requests**:
   - To `master` or `main` → Built but NOT pushed (validation only)

4. **Manual trigger**:
   - Via GitHub Actions UI (workflow_dispatch)

### Published Tags

Images are published to: `ghcr.io/OWNER/REPO`

**For push to master/main**:
- `latest`
- `master-abc1234` (SHA)

**For version tags** (e.g., `v1.2.3`):
- `1.2.3` (semantic version)
- `1.2` (major.minor)
- `1` (major)
- `latest`

**For branch pushes**:
- `branch-name`
- `branch-name-abc1234` (SHA)

**For pull requests**:
- Built but not pushed
- Comment added to PR with build status

### Multi-Architecture Support

Images are built for:
- `linux/amd64` (x86_64)
- `linux/arm64` (ARM64/Apple Silicon)

### Features

✅ **Automatic version detection** from `package.json`  
✅ **Multi-platform builds** (amd64 + arm64)  
✅ **Layer caching** for faster builds (GitHub Actions cache)  
✅ **Build attestation** for supply chain security  
✅ **PR comments** with build status  
✅ **Semantic versioning** support  

### Setup Instructions

#### 1. Enable GitHub Container Registry

GHCR is enabled by default for all GitHub repositories. No additional setup needed.

#### 2. Make Package Public (Optional)

After the first successful build:

1. Go to your GitHub repository
2. Navigate to **Packages** (right sidebar)
3. Click on your package
4. Go to **Package settings**
5. Scroll to **Danger Zone**
6. Click **Change visibility** → **Public**

#### 3. Link Package to Repository (Optional)

In Package settings:
1. Scroll to **Danger Zone**
2. Under **Connect repository**, select your repo
3. This shows the package on your repo page

### Usage

#### Pull the Image

```bash
# Latest version
docker pull ghcr.io/OWNER/REPO:latest

# Specific version
docker pull ghcr.io/OWNER/REPO:1.0.0

# Specific branch
docker pull ghcr.io/OWNER/REPO:develop
```

#### Use in docker-compose.yml

```yaml
services:
  duplistatus:
    image: ghcr.io/OWNER/REPO:latest
    # ... rest of config
```

### Publishing a Release

To publish a new version:

```bash
# Tag the release
git tag -a v1.0.0 -m "Release v1.0.0"

# Push the tag
git push origin v1.0.0
```

This will trigger the workflow and publish:
- `ghcr.io/OWNER/REPO:1.0.0`
- `ghcr.io/OWNER/REPO:1.0`
- `ghcr.io/OWNER/REPO:1`
- `ghcr.io/OWNER/REPO:latest`

### Monitoring

#### Check Workflow Status

1. Go to **Actions** tab in GitHub
2. Click on workflow run
3. View logs for each step

#### Check Published Images

1. Go to repository page
2. Click **Packages** (right sidebar)
3. View all published versions

#### Pull Statistics

GHCR provides pull statistics in the package page.

### Troubleshooting

#### Problem: Workflow fails with "permission denied"

**Solution**: Check repository permissions:
1. Go to **Settings** → **Actions** → **General**
2. Under **Workflow permissions**, select:
   - ✅ Read and write permissions
3. Save

#### Problem: Image not appearing in package list

**Solution**: Wait a few minutes after first push. Then:
1. Check workflow logs for errors
2. Verify package exists at `https://github.com/OWNER/REPO/pkgs/container/REPO`

#### Problem: Cannot pull image (unauthorized)

**Solution**: 
- For public packages: No auth needed
- For private packages: Login first:
  ```bash
  echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
  ```

#### Problem: Multi-arch build fails

**Solution**: This is usually due to platform-specific dependencies. Check:
1. Dockerfile uses multi-stage builds correctly
2. Base images support both architectures
3. No architecture-specific binaries in COPY steps

### Security

- **No secrets required**: Uses `GITHUB_TOKEN` (automatic)
- **Build attestation**: Cryptographic proof of build provenance
- **Vulnerability scanning**: Enable Dependabot in repository settings
- **Image signing**: Cosign support (optional, can be added)

### Advanced Configuration

#### Build Only on Specific Paths

Add to workflow trigger:

```yaml
on:
  push:
    paths:
      - 'src/**'
      - 'Dockerfile'
      - 'package.json'
```

#### Add Docker Hub Publishing

Add to workflow:

```yaml
- name: Log in to Docker Hub
  uses: docker/login-action@v3
  with:
    username: ${{ secrets.DOCKERHUB_USERNAME }}
    password: ${{ secrets.DOCKERHUB_TOKEN }}

- name: Extract Docker Hub metadata
  id: meta-dockerhub
  uses: docker/metadata-action@v5
  with:
    images: DOCKERHUB_USERNAME/REPO
```

#### Custom Build Args

Add to build step:

```yaml
build-args: |
  VERSION=${{ steps.package-version.outputs.version }}
  BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
  COMMIT_SHA=${{ github.sha }}
```

### CI/CD Integration

This workflow integrates with:
- **Dependabot**: Automatic dependency updates
- **CodeQL**: Code security analysis
- **Branch protection**: Require builds to pass before merge

### Performance

- **First build**: ~5-10 minutes (no cache)
- **Subsequent builds**: ~2-5 minutes (with cache)
- **Multi-arch**: ~8-15 minutes (builds both architectures)

### Cost

- **GitHub Actions**: 2,000 free minutes/month (public repos)
- **GHCR Storage**: Unlimited for public packages, 500MB free for private
- **GHCR Bandwidth**: Unlimited

## See Also

- [GitHub Container Registry Docs](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [Docker Metadata Action](https://github.com/docker/metadata-action)
