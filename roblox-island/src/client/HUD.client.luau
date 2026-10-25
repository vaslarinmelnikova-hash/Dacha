local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local Remotes = ReplicatedStorage:WaitForChild("Remotes")

local player = Players.LocalPlayer
local font = Enum.Font.SourceSansBold

local gui = Instance.new("ScreenGui")
gui.Name = "HUD"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.Parent = player:WaitForChild("PlayerGui")

local function corner(parent: Instance, radius: number?)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, radius or 8)
	c.Parent = parent
end

local function label(parent: Instance, text: string, size: number): TextLabel
	local l = Instance.new("TextLabel")
	l.BackgroundTransparency = 1
	l.Font = font
	l.TextColor3 = Color3.new(1, 1, 1)
	l.TextSize = size
	l.Text = text
	l.TextStrokeTransparency = 0.6
	l.Parent = parent
	return l
end

-- Inventory

local inventory = Instance.new("Frame")
inventory.Position = UDim2.fromOffset(16, 60)
inventory.Size = UDim2.fromOffset(190, 34 * #Config.Items + 16)
inventory.BackgroundColor3 = Color3.fromRGB(25, 25, 30)
inventory.BackgroundTransparency = 0.35
inventory.Parent = gui
corner(inventory)

local itemLabels: { [string]: TextLabel } = {}
for i, item in Config.Items do
	local l = label(inventory, "", 22)
	l.TextXAlignment = Enum.TextXAlignment.Left
	l.Position = UDim2.fromOffset(14, 8 + (i - 1) * 34)
	l.Size = UDim2.new(1, -28, 0, 32)
	itemLabels[item] = l
end

-- Health and hunger bars

local function bar(y: number, color: Color3, title: string): (Frame, TextLabel)
	local back = Instance.new("Frame")
	back.AnchorPoint = Vector2.new(0.5, 1)
	back.Position = UDim2.new(0.5, 0, 1, y)
	back.Size = UDim2.fromOffset(320, 24)
	back.BackgroundColor3 = Color3.fromRGB(25, 25, 30)
	back.BackgroundTransparency = 0.25
	back.Parent = gui
	corner(back, 6)

	local fill = Instance.new("Frame")
	fill.Size = UDim2.fromScale(1, 1)
	fill.BackgroundColor3 = color
	fill.Parent = back
	corner(fill, 6)

	local text = label(back, title, 18)
	text.Size = UDim2.fromScale(1, 1)
	text.ZIndex = 2
	return fill, text
end

local healthFill, healthText = bar(-48, Color3.fromRGB(200, 55, 55), "Здоровье")
local hungerFill, hungerText = bar(-18, Color3.fromRGB(220, 140, 40), "Голод")

local function setBar(fill: Frame, text: TextLabel, title: string, value: number, max: number)
	local ratio = math.clamp(value / max, 0, 1)
	fill.Size = UDim2.fromScale(ratio, 1)
	fill.Visible = ratio > 0
	text.Text = string.format("%s: %d", title, math.ceil(value))
end

local function watchHumanoid(character: Model)
	local humanoid = character:WaitForChild("Humanoid") :: Humanoid
	local function update()
		setBar(healthFill, healthText, "Здоровье", humanoid.Health, humanoid.MaxHealth)
	end
	humanoid.HealthChanged:Connect(update)
	update()
end

player.CharacterAdded:Connect(watchHumanoid)
if player.Character then
	task.spawn(watchHumanoid, player.Character)
end

-- Crafting

local craftPanel = Instance.new("Frame")
craftPanel.AnchorPoint = Vector2.new(1, 0.5)
craftPanel.Position = UDim2.new(1, -16, 0.5, 0)
craftPanel.Size = UDim2.fromOffset(320, 56 + #Config.Recipes * 64)
craftPanel.BackgroundColor3 = Color3.fromRGB(25, 25, 30)
craftPanel.BackgroundTransparency = 0.2
craftPanel.Visible = false
craftPanel.Parent = gui
corner(craftPanel)

local craftTitle = label(craftPanel, "Крафт", 26)
craftTitle.Size = UDim2.new(1, 0, 0, 44)

local function costText(cost: { [string]: number }): string
	local parts = {}
	for _, item in Config.Items do
		if cost[item] then
			table.insert(parts, string.format("%s %d", Config.ItemNames[item], cost[item]))
		end
	end
	return table.concat(parts, ", ")
end

local recipeButtons: { [TextButton]: { [string]: number } } = {}
for i, recipe in Config.Recipes do
	local button = Instance.new("TextButton")
	button.Position = UDim2.fromOffset(12, 44 + (i - 1) * 64)
	button.Size = UDim2.new(1, -24, 0, 56)
	button.Font = font
	button.TextSize = 20
	button.TextColor3 = Color3.new(1, 1, 1)
	button.Text = recipe.Display .. "\n" .. costText(recipe.Cost)
	button.AutoButtonColor = true
	button.Parent = craftPanel
	corner(button, 6)
	button.Activated:Connect(function()
		Remotes.Action:FireServer("Craft", recipe.Id)
	end)
	recipeButtons[button] = recipe.Cost
end

local function refreshInventory()
	for item, l in itemLabels do
		l.Text = string.format("%s: %d", Config.ItemNames[item], player:GetAttribute(item) or 0)
	end
	for button, cost in recipeButtons do
		local affordable = true
		for item, amount in cost do
			if (player:GetAttribute(item) or 0) < amount then
				affordable = false
			end
		end
		button.BackgroundColor3 = affordable and Color3.fromRGB(60, 120, 60) or Color3.fromRGB(70, 70, 75)
	end
end

local function refreshHunger()
	setBar(hungerFill, hungerText, "Голод", player:GetAttribute("Hunger") or 0, Config.Survival.MaxHunger)
end

for _, item in Config.Items do
	player:GetAttributeChangedSignal(item):Connect(refreshInventory)
end
player:GetAttributeChangedSignal("Hunger"):Connect(refreshHunger)
refreshInventory()
refreshHunger()

-- Controls hint

local hint = label(gui, "ЛКМ — бить   |   C — крафт   |   F — съесть ягоду", 18)
hint.AnchorPoint = Vector2.new(0.5, 1)
hint.Position = UDim2.new(0.5, 0, 1, -78)
hint.Size = UDim2.fromOffset(500, 24)
hint.TextTransparency = 0.2

UserInputService.InputBegan:Connect(function(input, processed)
	if processed then
		return
	end
	if input.KeyCode == Enum.KeyCode.C then
		craftPanel.Visible = not craftPanel.Visible
	elseif input.KeyCode == Enum.KeyCode.F then
		Remotes.Action:FireServer("Eat")
	end
end)

-- Notifications

local feed = Instance.new("Frame")
feed.AnchorPoint = Vector2.new(0.5, 1)
feed.Position = UDim2.new(0.5, 0, 1, -110)
feed.Size = UDim2.fromOffset(400, 200)
feed.BackgroundTransparency = 1
feed.Parent = gui

local layout = Instance.new("UIListLayout")
layout.VerticalAlignment = Enum.VerticalAlignment.Bottom
layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
layout.Padding = UDim.new(0, 4)
layout.Parent = feed

Remotes.Notify.OnClientEvent:Connect(function(text: string)
	local l = label(feed, text, 22)
	l.Size = UDim2.new(1, 0, 0, 26)
	task.delay(1.5, function()
		local tween = TweenService:Create(l, TweenInfo.new(0.6), { TextTransparency = 1, TextStrokeTransparency = 1 })
		tween.Completed:Connect(function()
			l:Destroy()
		end)
		tween:Play()
	end)
end)
