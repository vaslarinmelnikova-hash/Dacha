local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)

local Tools = {}

local stoneColor = Color3.fromRGB(125, 125, 130)
local woodColor = Color3.fromRGB(110, 75, 45)

local function attach(handle: BasePart, piece: BasePart, offset: CFrame)
	piece.CFrame = handle.CFrame * offset
	piece.CanCollide = false
	piece.Massless = true
	piece.Parent = handle.Parent
	local weld = Instance.new("WeldConstraint")
	weld.Part0 = handle
	weld.Part1 = piece
	weld.Parent = piece
end

local function newPart(size: Vector3, color: Color3, material: Enum.Material): Part
	local p = Instance.new("Part")
	p.Size = size
	p.Color = color
	p.Material = material
	p.CanCollide = false
	p.Massless = true
	return p
end

local looks = {}

function looks.Rock(tool: Tool)
	local handle = newPart(Vector3.new(1.3, 1.1, 1.3), stoneColor, Enum.Material.Slate)
	handle.Name = "Handle"
	handle.Parent = tool
	tool.Grip = CFrame.new(0, 0, 0)
end

local function stickWithHead(tool: Tool, headSize: Vector3)
	local handle = newPart(Vector3.new(0.35, 0.35, 3.2), woodColor, Enum.Material.Wood)
	handle.Name = "Handle"
	handle.Parent = tool
	attach(handle, newPart(headSize, stoneColor, Enum.Material.Slate), CFrame.new(0, 0.3, 1.4))
	tool.Grip = CFrame.new(0, 0, -1.2)
end

function looks.StoneHatchet(tool: Tool)
	stickWithHead(tool, Vector3.new(0.4, 1.3, 0.8))
end

function looks.StonePickaxe(tool: Tool)
	stickWithHead(tool, Vector3.new(0.4, 2.4, 0.5))
end

function Tools.Create(id: string, onSwing: (Player, Tool, string) -> ()): Tool
	local def = Config.Tools[id]
	local tool = Instance.new("Tool")
	tool.Name = def.Display
	tool.CanBeDropped = false
	tool:SetAttribute("ToolId", id)
	looks[id](tool)

	local lastSwing = 0
	tool.Activated:Connect(function()
		local now = os.clock()
		if now - lastSwing < def.Cooldown then
			return
		end
		lastSwing = now

		local player = game:GetService("Players"):GetPlayerFromCharacter(tool.Parent)
		if not player then
			return
		end

		-- The default Animate script plays its slash animation when it sees this value.
		local anim = Instance.new("StringValue")
		anim.Name = "toolanim"
		anim.Value = "Slash"
		anim.Parent = tool

		onSwing(player, tool, id)
	end)

	return tool
end

function Tools.Has(player: Player, id: string): boolean
	for _, container in { player:FindFirstChild("Backpack"), player.Character } do
		if container then
			for _, item in container:GetChildren() do
				if item:IsA("Tool") and item:GetAttribute("ToolId") == id then
					return true
				end
			end
		end
	end
	return false
end

return Tools
