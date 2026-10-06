import { execFileSync } from "node:child_process";

export default function setup() {
  execFileSync("docker", ["compose", "up", "-d", "--wait", "mongo"], {
    stdio: "inherit",
  });
}
