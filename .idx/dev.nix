{pkgs}: {
  channel = "stable-23.11";
  packages = [
    pkgs.nodejs_20
  ];
  idx = {
    extensions = [];
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["npx" "serve" "dist" "-l" "$PORT"];
          manager = "web";
        };
      };
    };
    workspace = {
      onCreate = {
        npm-install = "cd /home/user/buchustudio1/policy2026 && npm install && npm run build";
      };
    };
  };
}
