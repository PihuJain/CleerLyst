import { auth } from "@/lib/auth"
import { NavigationClient } from "./navigation-client"

const Navigation = async () => {
  const session = await auth()

  return <NavigationClient session={session} />
}

export default Navigation